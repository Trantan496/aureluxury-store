from __future__ import annotations

import asyncio
import base64
import io
import os
import sys
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image, ImageOps, UnidentifiedImageError

SERVICE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SERVICE_DIR.parent
CATVTON_DIR = Path(os.environ.get("CATVTON_DIR", str(BACKEND_DIR / "cat-vton"))).resolve()
HF_CACHE_DIR = Path(os.environ.get("HF_HOME", str(CATVTON_DIR / ".hf_cache"))).resolve()
HF_CACHE_DIR.mkdir(parents=True, exist_ok=True)
os.environ["HF_HOME"] = str(HF_CACHE_DIR)
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
if (HF_CACHE_DIR / "hub" / "models--stabilityai--sd-vae-ft-mse").is_dir():
    os.environ.setdefault("HF_HUB_OFFLINE", "1")

if str(CATVTON_DIR) not in sys.path:
    sys.path.insert(0, str(CATVTON_DIR))

import torch  # noqa: E402
from diffusers import DDIMScheduler, DPMSolverMultistepScheduler  # noqa: E402
from diffusers.image_processor import VaeImageProcessor  # noqa: E402
from huggingface_hub import snapshot_download  # noqa: E402
from safetensors.torch import load_file  # noqa: E402
from model.SCHP import SCHP  # noqa: E402
from model.pipeline import CatVTONPipeline  # noqa: E402
from utils import resize_and_crop, resize_and_padding  # noqa: E402

ATR_MAPPING = {
    "Background": 0, "Hat": 1, "Hair": 2, "Sunglasses": 3,
    "Upper-clothes": 4, "Skirt": 5, "Pants": 6, "Dress": 7,
    "Belt": 8, "Left-shoe": 9, "Right-shoe": 10, "Face": 11,
    "Left-leg": 12, "Right-leg": 13, "Left-arm": 14, "Right-arm": 15,
    "Bag": 16, "Scarf": 17,
}
LIP_MAPPING = {
    "Background": 0, "Hat": 1, "Hair": 2, "Glove": 3,
    "Sunglasses": 4, "Upper-clothes": 5, "Dress": 6, "Coat": 7,
    "Socks": 8, "Pants": 9, "Jumpsuits": 10, "Scarf": 11,
    "Skirt": 12, "Face": 13, "Left-arm": 14, "Right-arm": 15,
    "Left-leg": 16, "Right-leg": 17, "Left-shoe": 18, "Right-shoe": 19,
}
PROTECT_BODY_PARTS = {
    "upper": ["Left-leg", "Right-leg"],
    "lower": ["Right-arm", "Left-arm", "Face"],
    "overall": [],
}
PROTECT_CLOTH_PARTS = {
    "upper": {"ATR": ["Skirt", "Pants"], "LIP": ["Skirt", "Pants"]},
    "lower": {"ATR": ["Upper-clothes"], "LIP": ["Upper-clothes", "Coat"]},
    "overall": {"ATR": [], "LIP": []},
}
MASK_CLOTH_PARTS = {
    "upper": ["Upper-clothes", "Coat", "Dress", "Jumpsuits"],
    "lower": ["Pants", "Skirt", "Dress", "Jumpsuits", "Belt"],
    "overall": ["Upper-clothes", "Dress", "Pants", "Skirt", "Coat", "Jumpsuits", "Belt"],
}


def part_mask_of(part: str | list[str], parse: np.ndarray, mapping: dict[str, int]) -> np.ndarray:
    if isinstance(part, str):
        part = [part]
    mask = np.zeros(parse.shape, dtype=np.uint8)
    for one in part:
        if one in mapping:
            mask |= (parse == mapping[one]).astype(np.uint8)
    return mask


def hull_mask(mask_area: np.ndarray) -> np.ndarray:
    ret, binary = cv2.threshold(mask_area, 127, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    hull_img = np.zeros_like(mask_area)
    for c in contours:
        cv2.drawContours(hull_img, [cv2.convexHull(c)], -1, 255, -1)
    return hull_img

ACCEL_PRESETS: dict[str, tuple[str, int, float]] = {
    "hyper8": ("Hyper-SD15-8steps-lora.safetensors", 8, 1.0),
    "hyper4": ("Hyper-SD15-4steps-lora.safetensors", 4, 1.0),
}
ACCEL_MODE = os.environ.get("CATVTON_ACCEL", "hyper8").strip().lower()
_default_steps = ACCEL_PRESETS[ACCEL_MODE][1] if ACCEL_MODE in ACCEL_PRESETS else 15
_default_guidance = ACCEL_PRESETS[ACCEL_MODE][2] if ACCEL_MODE in ACCEL_PRESETS else 2.5

TARGET_WIDTH = int(os.environ.get("CATVTON_WIDTH", "576"))
TARGET_HEIGHT = int(os.environ.get("CATVTON_HEIGHT", "768"))
OUTPUT_WIDTH = int(os.environ.get("CATVTON_OUTPUT_WIDTH", "768"))
OUTPUT_HEIGHT = int(os.environ.get("CATVTON_OUTPUT_HEIGHT", "1024"))
INFERENCE_STEPS = int(os.environ.get("CATVTON_STEPS", str(_default_steps)))
GUIDANCE_SCALE = float(os.environ.get("CATVTON_GUIDANCE", str(_default_guidance)))
MAX_IMAGE_BYTES = int(os.environ.get("TRYON_MAX_IMAGE_BYTES", str(10 * 1024 * 1024)))
INFERENCE_TIMEOUT_SEC = float(os.environ.get("TRYON_TIMEOUT_SECONDS", "60"))

SD_INPAINTING_LOCAL = CATVTON_DIR / "checkpoints" / "sd-inpainting"


def _resolve_hypersd_lora(filename: str) -> Path | None:
    candidates = [
        HF_CACHE_DIR / "models--ByteDance--Hyper-SD" / "snapshots",
        HF_CACHE_DIR / "hub" / "models--ByteDance--Hyper-SD" / "snapshots",
    ]
    for snap_root in candidates:
        if snap_root.is_dir():
            for snap in snap_root.iterdir():
                lora_file = snap / filename
                if lora_file.is_file():
                    return lora_file
    return None


def _fuse_kohya_lora(unet: torch.nn.Module, lora_path: Path, scale: float = 1.0) -> int:
    """Fuse Kohya-format Hyper-SD LoRA weights directly into UNet weights for zero runtime overhead."""
    state = load_file(str(lora_path), device="cpu")
    name_map = {
        name.replace(".", "_"): mod
        for name, mod in unet.named_modules()
        if isinstance(mod, (torch.nn.Linear, torch.nn.Conv2d))
    }
    prefixes = {k.split(".")[0] for k in state.keys() if k.startswith("lora_unet_")}
    matched = 0
    with torch.no_grad():
        for pfx in prefixes:
            key_norm = pfx[len("lora_unet_"):]
            mod = name_map.get(key_norm)
            if mod is None:
                continue
            down = state[f"{pfx}.lora_down.weight"].float()
            up = state[f"{pfx}.lora_up.weight"].float()
            alpha_key = f"{pfx}.alpha"
            rank = float(down.shape[0])
            alpha = float(state[alpha_key].item()) if alpha_key in state else rank
            ratio = scale * (alpha / rank)
            if down.ndim == 4:
                if down.shape[2:] == (1, 1) and up.shape[2:] == (1, 1):
                    delta = (up.squeeze(3).squeeze(2) @ down.squeeze(3).squeeze(2)).unsqueeze(2).unsqueeze(3)
                else:
                    delta = torch.einsum("orhw,rikl->oikl", up, down)
            else:
                delta = up @ down
            mod.weight.data.add_((delta * ratio).to(device=mod.weight.device, dtype=mod.weight.dtype))
            matched += 1
    return matched


def _resolve_catvton_snapshot() -> str:
    hub_dir = HF_CACHE_DIR / "hub" / "models--zhengchong--CatVTON" / "snapshots"
    if hub_dir.is_dir():
        snaps = [p for p in hub_dir.iterdir() if p.is_dir()]
        if snaps:
            return str(snaps[0])
    return snapshot_download(
        "zhengchong/CatVTON",
        allow_patterns=["mix-48k-1024/*", "SCHP/*", "config.json"],
    )


def _keep_main_components(binary_u8: np.ndarray, min_area_ratio: float = 0.008) -> np.ndarray:
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(binary_u8, connectivity=8)
    if num_labels <= 1:
        return binary_u8
    total_area = float(binary_u8.shape[0] * binary_u8.shape[1])
    out = np.zeros_like(binary_u8)
    for lbl in range(1, num_labels):
        if stats[lbl, cv2.CC_STAT_AREA] >= total_area * min_area_ratio:
            out[labels == lbl] = 1
    return out


def _prepare_person_canvas(
    person_raw: Image.Image,
    target_size: tuple[int, int],
) -> tuple[Image.Image, int, int]:
    """Preserve 100% vertical height (head to shoes) for portrait photos narrower than 3:4."""
    target_w, target_h = target_size
    w, h = person_raw.size
    if w <= 0 or h <= 0:
        return resize_and_crop(person_raw, target_size), 0, target_w

    target_ratio = target_w / float(target_h)
    src_ratio = w / float(h)
    if src_ratio >= target_ratio - 1e-3:
        return resize_and_crop(person_raw, target_size), 0, target_w

    scaled_w = max(1, min(target_w, int(round(w * (target_h / float(h))))))
    resized = person_raw.resize((scaled_w, target_h), Image.Resampling.LANCZOS)
    pad_left = (target_w - scaled_w) // 2
    pad_right = target_w - scaled_w - pad_left
    if pad_left == 0 and pad_right == 0:
        return resized, 0, target_w

    arr = np.asarray(resized, dtype=np.uint8)
    padded = cv2.copyMakeBorder(arr, 0, 0, pad_left, pad_right, cv2.BORDER_REPLICATE)
    if pad_left > 2:
        padded[:, :pad_left] = cv2.GaussianBlur(padded[:, :pad_left], (15, 15), 0)
    if pad_right > 2:
        padded[:, target_w - pad_right :] = cv2.GaussianBlur(padded[:, target_w - pad_right :], (15, 15), 0)
    return Image.fromarray(padded, mode="RGB"), pad_left, scaled_w


def _get_garment_foreground_bbox(garment_raw: Image.Image) -> tuple[int, int, int, int]:
    arr = np.asarray(garment_raw.convert("RGB"), dtype=np.float32)
    h, w, _ = arr.shape
    border = np.concatenate([arr[0, :], arr[-1, :], arr[:, 0], arr[:, -1]], axis=0)
    bg_color = np.median(border, axis=0)
    dist = np.max(np.abs(arr - bg_color[None, None, :]), axis=2)
    fg = (dist > 14.0).astype(np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8), iterations=1)
    fg = _keep_main_components(fg, min_area_ratio=0.003)
    ys, xs = np.where(fg > 0)
    if len(xs) < 25 or len(ys) < 25:
        return 0, 0, w, h
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def _is_short_lower_garment(garment_raw: Image.Image) -> bool:
    x0, y0, x1, y1 = _get_garment_foreground_bbox(garment_raw)
    bw = max(1, x1 - x0)
    bh = max(1, y1 - y0)
    return (bh / float(bw)) < 1.18


def _prepare_garment_canvas(
    garment_raw: Image.Image,
    part: str,
    is_short_lower: bool = False,
) -> Image.Image:
    if part == "lower" and is_short_lower:
        x0, y0, x1, y1 = _get_garment_foreground_bbox(garment_raw)
        w, h = garment_raw.size
        pad_x = max(4, int((x1 - x0) * 0.05))
        pad_y = max(4, int((y1 - y0) * 0.05))
        crop_box = (
            max(0, x0 - pad_x),
            max(0, y0 - pad_y),
            min(w, x1 + pad_x),
            min(h, y1 + pad_y),
        )
        cropped = garment_raw.crop(crop_box)
        cw, ch = cropped.size
        max_w = int(TARGET_WIDTH * 0.70)
        max_h = int(TARGET_HEIGHT * 0.48)
        scale = min(max_w / float(max(1, cw)), max_h / float(max(1, ch)))
        new_w = max(1, int(round(cw * scale)))
        new_h = max(1, int(round(ch * scale)))
        resized = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (TARGET_WIDTH, TARGET_HEIGHT), (255, 255, 255))
        paste_x = (TARGET_WIDTH - new_w) // 2
        paste_y = int(TARGET_HEIGHT * 0.10)
        canvas.paste(resized, (paste_x, paste_y))
        return canvas
    return resize_and_padding(garment_raw, (TARGET_WIDTH, TARGET_HEIGHT))


def _build_schp_masks(
    person_img: Image.Image,
    schp_lip: SCHP,
    schp_atr: SCHP,
    part: str = "upper",
    is_short_lower: bool = False,
) -> tuple[Image.Image, np.ndarray, np.ndarray]:
    w, h = person_img.size
    lip_np = np.array(schp_lip(person_img))
    atr_np = np.array(schp_atr(person_img))

    # LIP "Face" stops at the chin line; ATR includes exposed neck/clavicle skin in "Face".
    lip_face = part_mask_of("Face", lip_np, LIP_MAPPING).astype(np.uint8)
    face_protect = lip_face if lip_face.sum() > 20 else part_mask_of("Face", atr_np, ATR_MAPPING).astype(np.uint8)
    hair_raw = (part_mask_of(["Hair"], lip_np, LIP_MAPPING) | part_mask_of(["Hair"], atr_np, ATR_MAPPING)).astype(np.uint8)
    head_accessory = (
        part_mask_of(["Hat", "Sunglasses"], lip_np, LIP_MAPPING)
        | part_mask_of(["Hat", "Sunglasses"], atr_np, ATR_MAPPING)
    ).astype(np.uint8)

    ys = np.where(face_protect > 0)[0]
    face_bottom = int(ys.max()) if len(ys) > 0 else h // 4
    head_zone = np.zeros((h, w), dtype=np.uint8)
    head_zone[: min(h, face_bottom + max(4, h // 128)), :] = 1

    head_protect = cv2.dilate(
        (face_protect | head_accessory | (hair_raw & head_zone)).astype(np.uint8),
        np.ones((3, 3), np.uint8),
        iterations=1,
    )
    body_protect = part_mask_of(PROTECT_BODY_PARTS[part], lip_np, LIP_MAPPING) | part_mask_of(
        PROTECT_BODY_PARTS[part], atr_np, ATR_MAPPING
    )
    cloth_protect = (
        part_mask_of(PROTECT_CLOTH_PARTS[part]["LIP"], lip_np, LIP_MAPPING)
        | part_mask_of(PROTECT_CLOTH_PARTS[part]["ATR"], atr_np, ATR_MAPPING)
    ).astype(np.uint8)
    cloth_protect = cv2.erode(cloth_protect, np.ones((3, 3), np.uint8), iterations=1)
    accessory_parts = ["Hat", "Glove", "Sunglasses", "Bag", "Left-shoe", "Right-shoe", "Scarf", "Socks"]
    accessory_protect = part_mask_of(accessory_parts, lip_np, LIP_MAPPING) | part_mask_of(
        accessory_parts, atr_np, ATR_MAPPING
    )
    weak_protect = (head_protect | body_protect | cloth_protect | accessory_protect).astype(np.uint8)

    cloth_mask = (
        part_mask_of(MASK_CLOTH_PARTS[part], lip_np, LIP_MAPPING)
        | part_mask_of(MASK_CLOTH_PARTS[part], atr_np, ATR_MAPPING)
    ).astype(np.uint8)
    cloth_mask = _keep_main_components(cloth_mask, min_area_ratio=0.008)
    arm_mask = (
        part_mask_of(["Left-arm", "Right-arm"], lip_np, LIP_MAPPING)
        | part_mask_of(["Left-arm", "Right-arm"], atr_np, ATR_MAPPING)
    ).astype(np.uint8)
    leg_mask = (
        part_mask_of(["Left-leg", "Right-leg"], lip_np, LIP_MAPPING)
        | part_mask_of(["Left-leg", "Right-leg"], atr_np, ATR_MAPPING)
    ).astype(np.uint8)

    if part in ("upper", "outer"):
        mask_area = cloth_mask | arm_mask
    elif part == "lower":
        # If trying on shorts onto someone already wearing shorts, keep lower calves unmasked.
        # Otherwise include full legs so long pants cover bare legs down to the shoes.
        if is_short_lower and int(leg_mask.sum()) > int(cloth_mask.sum()) * 0.45:
            leg_ys = np.where(leg_mask > 0)[0]
            if len(leg_ys) > 10:
                cutoff_y = int(np.percentile(leg_ys, 35))
                upper_leg = leg_mask.copy()
                upper_leg[cutoff_y:, :] = 0
                mask_area = cloth_mask | upper_leg
            else:
                mask_area = cloth_mask
        else:
            mask_area = cloth_mask | leg_mask
    else:
        mask_area = cloth_mask | arm_mask | leg_mask

    dilate_sz = max(5, max(w, h) // 85)
    if dilate_sz % 2 == 0:
        dilate_sz += 1
    mask_area = cv2.dilate(mask_area, np.ones((dilate_sz, dilate_sz), np.uint8), iterations=2)
    mask_area = (hull_mask(mask_area * 255) // 255).astype(np.uint8)
    mask_area = mask_area & (~weak_protect)
    mask_area = _keep_main_components(mask_area, min_area_ratio=0.008)
    if int(mask_area.sum()) < int(w * h * 0.015):
        fallback = np.zeros((h, w), dtype=np.uint8)
        if part == "lower":
            fallback[int(h * 0.45) : int(h * 0.90), int(w * 0.22) : int(w * 0.78)] = 1
        elif part == "overall":
            fallback[int(h * 0.20) : int(h * 0.90), int(w * 0.20) : int(w * 0.80)] = 1
        else:
            fallback[int(h * 0.20) : int(h * 0.62), int(w * 0.20) : int(w * 0.80)] = 1
        mask_area = fallback & (~head_protect)
    mask_area = np.where(head_protect > 0, 0, mask_area).astype(np.uint8)
    raw_u8 = (mask_area * 255).astype(np.uint8)
    return Image.fromarray(raw_u8, mode="L"), head_protect, raw_u8


def _build_schp_mask(
    person_img: Image.Image,
    schp_lip: SCHP,
    schp_atr: SCHP,
    part: str = "upper",
) -> Image.Image:
    mask_pil, _, _ = _build_schp_masks(person_img, schp_lip, schp_atr, part=part)
    return mask_pil


def _protect_mask_head(blurred_mask: Image.Image, head_protect: np.ndarray) -> Image.Image:
    mask_np = np.asarray(blurred_mask.convert("L"), dtype=np.uint8).copy()
    mask_np[head_protect > 0] = 0
    return Image.fromarray(mask_np, mode="L")


def _composite_preserve_identity(
    person_raw: Image.Image,
    result_img: Image.Image,
    raw_mask_u8: np.ndarray,
    head_protect: np.ndarray,
) -> Image.Image:
    """Keep original HD pixels outside garment mask and 100% of Face/Hair untouched by VAE."""
    person_hd, pad_left_hd, scaled_w_hd = _prepare_person_canvas(person_raw, (OUTPUT_WIDTH, OUTPUT_HEIGHT))
    gen_hd = result_img.resize((OUTPUT_WIDTH, OUTPUT_HEIGHT), Image.Resampling.LANCZOS)

    alpha_low = cv2.GaussianBlur(raw_mask_u8.astype(np.float32), (7, 7), 0) / 255.0
    alpha_low[head_protect > 0] = 0.0
    alpha_hd = cv2.resize(alpha_low, (OUTPUT_WIDTH, OUTPUT_HEIGHT), interpolation=cv2.INTER_LINEAR)
    alpha_hd = np.clip(alpha_hd, 0.0, 1.0)[..., None]

    person_np = np.asarray(person_hd, dtype=np.float32)
    gen_np = np.asarray(gen_hd, dtype=np.float32)
    blended = np.clip(person_np * (1.0 - alpha_hd) + gen_np * alpha_hd, 0.0, 255.0).astype(np.uint8)
    if pad_left_hd > 0 and scaled_w_hd < OUTPUT_WIDTH:
        blended = blended[:, pad_left_hd : pad_left_hd + scaled_w_hd]
    return Image.fromarray(blended, mode="RGB")


class TryOnEngine:
    def __init__(self) -> None:
        self.pipeline: CatVTONPipeline | None = None
        self.schp_atr: SCHP | None = None
        self.schp_lip: SCHP | None = None
        self.mask_processor: VaeImageProcessor | None = None
        self.device_name: str = "unavailable"
        self.active_accel: str = "dpmsolver15"
        self.load_error: str | None = None
        self.loading: bool = False
        self.ready_event = threading.Event()
        self.semaphore = asyncio.Semaphore(1)

    def load(self) -> None:
        self.loading = True
        try:
            self._load_models()
        except Exception as exc:
            self.load_error = str(exc)
        finally:
            self.loading = False
            self.ready_event.set()

    def _load_models(self) -> None:
        if not torch.cuda.is_available():
            self.load_error = "CUDA GPU is not available for CatVTON."
            return
        if not (SD_INPAINTING_LOCAL / "unet" / "diffusion_pytorch_model.bin").is_file():
            self.load_error = f"Missing SD-Inpainting UNet weights at {SD_INPAINTING_LOCAL}"
            return

        self.device_name = torch.cuda.get_device_name(0)
        torch.backends.cudnn.benchmark = True
        cat_dir = _resolve_catvton_snapshot()

        self.pipeline = CatVTONPipeline(
            base_ckpt=str(SD_INPAINTING_LOCAL),
            attn_ckpt=cat_dir,
            attn_ckpt_version="mix",
            weight_dtype=torch.bfloat16,
            device="cuda",
            skip_safety_check=True,
            use_tf32=True,
        )
        lora_path = (
            _resolve_hypersd_lora(ACCEL_PRESETS[ACCEL_MODE][0])
            if ACCEL_MODE in ACCEL_PRESETS
            else None
        )
        if lora_path is not None:
            _fuse_kohya_lora(self.pipeline.unet, lora_path, scale=1.0)
            self.pipeline.noise_scheduler = DDIMScheduler.from_config(
                self.pipeline.noise_scheduler.config,
                timestep_spacing="trailing",
            )
            self.active_accel = ACCEL_MODE
        else:
            self.pipeline.noise_scheduler = DPMSolverMultistepScheduler.from_config(
                self.pipeline.noise_scheduler.config,
                algorithm_type="dpmsolver++",
                use_karras_sigmas=False,
            )
            self.active_accel = "dpmsolver15"
            if ACCEL_MODE in ACCEL_PRESETS:
                # Fallback to full 15-step DPM++ settings if LoRA weights are missing
                global INFERENCE_STEPS, GUIDANCE_SCALE
                INFERENCE_STEPS = int(os.environ.get("CATVTON_STEPS", "15"))
                GUIDANCE_SCALE = float(os.environ.get("CATVTON_GUIDANCE", "2.5"))
        schp_dir = Path(cat_dir) / "SCHP"
        self.schp_atr = SCHP(ckpt_path=str(schp_dir / "exp-schp-201908301523-atr.pth"), device="cuda")
        self.schp_lip = SCHP(ckpt_path=str(schp_dir / "exp-schp-201908261155-lip.pth"), device="cuda")
        self.mask_processor = VaeImageProcessor(
            vae_scale_factor=8, do_normalize=False, do_binarize=True, do_convert_grayscale=True
        )
        self._warmup()
        self.load_error = None

    def _warmup(self) -> None:
        """Run a full dummy pass on startup so cuDNN/CUDA warmup never stalls request #1."""
        assert self.pipeline is not None and self.schp_lip is not None and self.schp_atr is not None
        assert self.mask_processor is not None
        dummy_raw = Image.new("RGB", (OUTPUT_WIDTH, OUTPUT_HEIGHT), (128, 128, 128))
        dummy_img = resize_and_crop(dummy_raw, (TARGET_WIDTH, TARGET_HEIGHT))
        raw_mask, head_protect, raw_mask_u8 = _build_schp_masks(
            dummy_img, self.schp_lip, self.schp_atr, part="upper"
        )
        dummy_mask = _protect_mask_head(self.mask_processor.blur(raw_mask, blur_factor=5), head_protect)
        gen = torch.Generator(device="cuda").manual_seed(0)
        with torch.inference_mode():
            result_img = self.pipeline(
                image=dummy_img,
                condition_image=dummy_img,
                mask=dummy_mask,
                num_inference_steps=INFERENCE_STEPS,
                guidance_scale=GUIDANCE_SCALE,
                height=TARGET_HEIGHT,
                width=TARGET_WIDTH,
                generator=gen,
            )[0]
            torch.cuda.synchronize()
        _composite_preserve_identity(dummy_raw, result_img, raw_mask_u8, head_protect)


engine = TryOnEngine()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    engine.loading = True
    load_task = asyncio.create_task(asyncio.to_thread(engine.load))
    yield
    if not load_task.done():
        load_task.cancel()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


app = FastAPI(title="AUREL CatVTON Local Inference Service", version="2.0.0", lifespan=lifespan)


def _decode_image(raw: bytes, label: str) -> Image.Image:
    if not raw:
        raise HTTPException(status_code=400, detail=f"Empty {label} image payload.")
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"{label} image exceeds maximum allowed size ({MAX_IMAGE_BYTES // (1024 * 1024)} MB).",
        )
    try:
        img = Image.open(io.BytesIO(raw))
        img = ImageOps.exif_transpose(img)
        img.load()
        if img.mode == "RGBA":
            bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
            img = Image.alpha_composite(bg, img).convert("RGB")
        else:
            img = img.convert("RGB")
        return img
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid {label} image: {exc}") from exc


def _extract_bag_rgba(bag_img: Image.Image) -> tuple[np.ndarray, np.ndarray, float]:
    """Extract clean studio bag RGB + soft alpha matte (0..1) and upper handle-hole ratio."""
    arr = np.asarray(bag_img.convert("RGB"), dtype=np.float32)
    h, w, _ = arr.shape
    border = np.concatenate([arr[0, :], arr[-1, :], arr[:, 0], arr[:, -1]], axis=0)
    bg_color = np.median(border, axis=0)

    color_dist = np.max(np.abs(arr - bg_color[None, None, :]), axis=2)
    lum = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
    bg_lum = float(0.299 * bg_color[0] + 0.587 * bg_color[1] + 0.114 * bg_color[2])
    lum_drop = np.maximum(0.0, bg_lum - lum)

    score = np.maximum(color_dist, lum_drop * 1.18)
    fg = (score > 11.5).astype(np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8), iterations=1)
    fg = _keep_main_components(fg, min_area_ratio=0.003)

    # Fill tiny specular holes inside leather/hardware while keeping open handle cutouts transparent
    inv = (1 - fg).astype(np.uint8)
    num_l, labels, stats, _ = cv2.connectedComponentsWithStats(inv, connectivity=8)
    max_pinhole = int(h * w * 0.012)
    for lbl in range(1, num_l):
        x, y, cw, ch, area = stats[lbl]
        touches_border = x == 0 or y == 0 or (x + cw >= w) or (y + ch >= h)
        if not touches_border and area < max_pinhole:
            fg[labels == lbl] = 1

    ys, xs = np.where(fg > 0)
    if len(xs) < 20 or len(ys) < 20:
        alpha_full = np.ones((h, w), dtype=np.float32)
        return arr, alpha_full, 0.0

    x0, x1 = max(0, int(xs.min()) - 2), min(w, int(xs.max()) + 3)
    y0, y1 = max(0, int(ys.min()) - 2), min(h, int(ys.max()) + 3)
    crop_rgb = arr[y0:y1, x0:x1].copy()
    crop_fg = fg[y0:y1, x0:x1].astype(np.float32)
    crop_score = score[y0:y1, x0:x1]

    # Measure handle opening ratio in the top 42% of the cropped bag bounding box
    ch, cw = crop_fg.shape
    top_slice = crop_fg[: max(1, int(ch * 0.42)), int(cw * 0.18) : max(int(cw * 0.18) + 1, int(cw * 0.82))]
    hole_ratio = float(1.0 - top_slice.mean()) if top_slice.size > 0 else 0.0

    # Smooth edge feathering with nearest-foreground color bleeding (zero white halo on dark outfits)
    fg_bin = (crop_fg > 0.5).astype(np.uint8)
    core_fg = cv2.erode(fg_bin, np.ones((3, 3), np.uint8), iterations=1)
    if int(core_fg.sum()) <= 50:
        core_fg = fg_bin
    if int(core_fg.sum()) > 50:
        # Fill background/fringe pixels with nearest solid bag pixel color before alpha blending
        dist, labels = cv2.distanceTransformWithLabels(
            (1 - core_fg).astype(np.uint8),
            cv2.DIST_L2,
            5,
            labelType=cv2.DIST_LABEL_PIXEL,
        )
        solid_coords = np.argwhere(core_fg > 0)
        # distanceTransformWithLabels gives 1-based label indexing over foreground pixels in row-major order
        valid = labels > 0
        nearest_idx = np.clip(labels[valid] - 1, 0, len(solid_coords) - 1)
        nr = solid_coords[nearest_idx]
        bleed_rgb = crop_rgb.copy()
        bleed_rgb[valid] = crop_rgb[nr[:, 0], nr[:, 1]]
        fringe = (core_fg == 0) & (dist <= 4.5)
        crop_rgb = np.where(fringe[..., None], bleed_rgb, crop_rgb)

    soft_ramp = np.clip((crop_score - 11.0) / 15.0, 0.0, 1.0)
    alpha = cv2.GaussianBlur(crop_fg, (3, 3), 0) * soft_ramp
    alpha = np.where(core_fg > 0, 1.0, alpha)
    alpha = cv2.GaussianBlur(alpha.astype(np.float32), (3, 3), 0)
    alpha = np.where(core_fg > 0, 1.0, np.clip(alpha, 0.0, 1.0))

    return crop_rgb, alpha, hole_ratio


def _run_bag_tryon_sync(person_raw: Image.Image, garment_raw: Image.Image, t_start: float) -> dict[str, Any]:
    """High-precision SCHP-guided bag & accessory virtual try-on preserving 100% of person identity & clothes."""
    assert engine.schp_lip is not None and engine.schp_atr is not None

    person_576, _, _ = _prepare_person_canvas(person_raw, (TARGET_WIDTH, TARGET_HEIGHT))
    person_hd, pad_left_hd, scaled_w_hd = _prepare_person_canvas(person_raw, (OUTPUT_WIDTH, OUTPUT_HEIGHT))

    lip_576 = np.array(engine.schp_lip(person_576))
    atr_576 = np.array(engine.schp_atr(person_576))
    lip_np = cv2.resize(lip_576, (OUTPUT_WIDTH, OUTPUT_HEIGHT), interpolation=cv2.INTER_NEAREST)
    atr_np = cv2.resize(atr_576, (OUTPUT_WIDTH, OUTPUT_HEIGHT), interpolation=cv2.INTER_NEAREST)

    bag_rgb, bag_alpha, hole_ratio = _extract_bag_rgba(garment_raw)
    t_pre = time.perf_counter()

    canvas_np = np.asarray(person_hd, dtype=np.float32).copy()
    H, W, _ = canvas_np.shape

    human_mask = ((lip_np > 0) | (atr_np > 0)).astype(np.uint8)
    old_bag_mask = (
        part_mask_of("Bag", lip_np, LIP_MAPPING) | part_mask_of("Bag", atr_np, ATR_MAPPING)
    ).astype(np.uint8)
    old_bag_mask = _keep_main_components(old_bag_mask, min_area_ratio=0.0008)

    body_no_bag = (human_mask & (~old_bag_mask)).astype(np.uint8)
    bys, bxs = np.where(body_no_bag > 0)
    if len(bxs) > 50 and len(bys) > 50:
        body_x0, body_x1 = int(np.percentile(bxs, 3)), int(np.percentile(bxs, 97))
        body_y0, body_y1 = int(bys.min()), int(bys.max())
    else:
        body_x0, body_x1 = int(W * 0.25), int(W * 0.75)
        body_y0, body_y1 = int(H * 0.08), int(H * 0.94)

    person_w = max(80, body_x1 - body_x0)
    person_h = max(240, body_y1 - body_y0)
    body_cx = 0.5 * (body_x0 + body_x1)

    bh_src, bw_src, _ = bag_rgb.shape
    bag_aspect = bw_src / float(max(1, bh_src))

    # Determine target bag dimensions proportional to the person's body
    if bag_aspect > 1.50 and hole_ratio < 0.12:
        # Wide bumbag / crossbody / waist pouch
        target_w = int(round(np.clip(person_w * 0.36, W * 0.12, W * 0.20)))
        target_h = max(1, int(round(target_w / bag_aspect)))
    elif bag_aspect >= 1.15 and hole_ratio < 0.10:
        # Structured executive clutch / compact pouch held in hand
        target_w = int(round(np.clip(person_w * 0.27, W * 0.10, W * 0.16)))
        target_h = max(1, int(round(target_w / bag_aspect)))
    else:
        # Hobo, tote, handbag, backpack, holdall with top handle/strap
        target_h = int(round(np.clip(person_h * 0.23, H * 0.15, H * 0.25)))
        target_w = max(1, int(round(target_h * bag_aspect)))
        max_bag_w = int(round(np.clip(person_w * 0.52, W * 0.15, W * 0.27)))
        if target_w > max_bag_w:
            target_w = max_bag_w
            target_h = max(1, int(round(target_w / bag_aspect)))

    # If the person already wears a visible bag, tightly inpaint the old bag region
    # and anchor the new bag at that natural carry location.
    old_ys, old_xs = np.where(old_bag_mask > 0)
    has_old_bag = len(old_xs) > int(H * W * 0.0008)

    if has_old_bag:
        inpaint_mask = cv2.dilate(old_bag_mask, np.ones((5, 5), np.uint8), iterations=1) * 255
        inpainted_u8 = cv2.inpaint(canvas_np.astype(np.uint8), inpaint_mask, 4, cv2.INPAINT_NS)
        feather = cv2.GaussianBlur((inpaint_mask > 0).astype(np.float32), (7, 7), 0)[..., None]
        canvas_np = canvas_np * (1.0 - feather) + inpainted_u8.astype(np.float32) * feather

        ox0, ox1 = int(old_xs.min()), int(old_xs.max())
        oy0, oy1 = int(old_ys.min()), int(old_ys.max())
        old_cx = 0.5 * (ox0 + ox1)
        old_cy = 0.5 * (oy0 + oy1)
        place_cx = int(round(old_cx))
        place_cy = int(round(old_cy))
        side_sign = -1 if old_cx < body_cx else 1
    else:
        # Locate arms/hands and hip/waistline from SCHP parsing
        upper_mask = (
            part_mask_of(["Upper-clothes", "Coat"], lip_np, LIP_MAPPING)
            | part_mask_of(["Upper-clothes"], atr_np, ATR_MAPPING)
        ).astype(np.uint8)
        lower_mask = (
            part_mask_of(["Pants", "Skirt"], lip_np, LIP_MAPPING)
            | part_mask_of(["Pants", "Skirt"], atr_np, ATR_MAPPING)
        ).astype(np.uint8)
        u_ys = np.where(upper_mask > 0)[0]
        l_ys = np.where(lower_mask > 0)[0]
        if len(u_ys) > 20 and len(l_ys) > 20:
            waist_y = int(0.5 * (np.percentile(u_ys, 90) + np.percentile(l_ys, 12)))
        elif len(u_ys) > 20:
            waist_y = int(np.percentile(u_ys, 88))
        else:
            waist_y = int(body_y0 + person_h * 0.48)

        arm_mask = (
            part_mask_of(["Left-arm", "Right-arm"], lip_np, LIP_MAPPING)
            | part_mask_of(["Left-arm", "Right-arm"], atr_np, ATR_MAPPING)
        ).astype(np.uint8)

        # Split arms into left-of-center and right-of-center in image space
        mid_x = int(round(body_cx))
        left_arm_img = arm_mask.copy()
        left_arm_img[:, mid_x:] = 0
        right_arm_img = arm_mask.copy()
        right_arm_img[:, :mid_x] = 0

        ly, lx = np.where(left_arm_img > 0)
        ry, rx = np.where(right_arm_img > 0)

        # Choose the side where the hand hangs naturally near the hip
        if bag_aspect > 1.55 and hole_ratio < 0.12:
            # Bumbag / crossbody worn across waist/chest
            place_cx = int(round(body_cx + person_w * 0.05))
            place_cy = int(round(waist_y - target_h * 0.05))
            side_sign = 1
        else:
            use_left = len(ly) > 40 and (len(ry) <= 40 or int(np.percentile(ly, 92)) >= int(np.percentile(ry, 92)))
            if use_left:
                side_sign = -1
                hand_y = int(np.percentile(ly, 90))
                hand_x = int(np.percentile(lx, 35))
            elif len(ry) > 40:
                side_sign = 1
                hand_y = int(np.percentile(ry, 90))
                hand_x = int(np.percentile(rx, 65))
            else:
                side_sign = -1
                hand_y = waist_y + int(person_h * 0.04)
                hand_x = int(round(body_cx - person_w * 0.36))

            hand_y = int(np.clip(hand_y, body_y0 + int(person_h * 0.36), body_y0 + int(person_h * 0.64)))
            if hole_ratio >= 0.10 or bag_aspect < 1.15:
                # Top-handle / shoulder bag hangs from the hand/wrist
                place_cx = int(round(hand_x + side_sign * target_w * 0.10))
                place_cy = int(round(hand_y + target_h * 0.30))
            else:
                # Clutch held at the hand/hip
                place_cx = int(round(hand_x + side_sign * target_w * 0.12))
                place_cy = int(round(hand_y + target_h * 0.15))

    # Resize extracted bag RGB + alpha to (target_w, target_h)
    bag_rgb_res = cv2.resize(bag_rgb, (target_w, target_h), interpolation=cv2.INTER_AREA)
    bag_alpha_res = cv2.resize(bag_alpha, (target_w, target_h), interpolation=cv2.INTER_LINEAR)
    bag_alpha_res = np.clip(bag_alpha_res, 0.0, 1.0)

    # Match ambient lighting gently to the person's clothes
    person_pixels = canvas_np[human_mask > 0]
    if len(person_pixels) > 100:
        scene_lum = float(np.mean(0.299 * person_pixels[:, 0] + 0.587 * person_pixels[:, 1] + 0.114 * person_pixels[:, 2]))
        gain = float(np.clip(0.92 + (scene_lum - 128.0) / 900.0, 0.88, 1.05))
        bag_rgb_res = np.clip(bag_rgb_res * gain, 0.0, 255.0)

    # Compute placement coordinates clamped inside the visible frame
    min_x_bound = pad_left_hd + 8
    max_x_bound = pad_left_hd + scaled_w_hd - 8
    x0 = int(np.clip(place_cx - target_w // 2, min_x_bound, max(min_x_bound, max_x_bound - target_w)))
    y0 = int(np.clip(place_cy - target_h // 2, int(H * 0.18), max(int(H * 0.18), H - target_h - 16)))
    x1 = min(W, x0 + target_w)
    y1 = min(H, y0 + target_h)
    tw, th = x1 - x0, y1 - y0
    bag_rgb_res = bag_rgb_res[:th, :tw]
    bag_alpha_res = bag_alpha_res[:th, :tw]

    # Render soft contact shadow & ambient cast shadow onto the person's body/clothes
    shadow_canvas = np.zeros((H, W), dtype=np.float32)
    shadow_canvas[y0:y1, x0:x1] = bag_alpha_res
    dx_inward = int(-side_sign * max(3, target_w // 28))
    dy_down = max(4, target_h // 26)

    M_contact = np.float32([[1, 0, dx_inward], [0, 1, dy_down]])
    contact_sh = cv2.warpAffine(shadow_canvas, M_contact, (W, H))
    contact_sh = cv2.GaussianBlur(contact_sh, (9, 9), 0) * 0.26

    M_cast = np.float32([[1, 0, dx_inward * 2], [0, 1, dy_down * 2]])
    cast_sh = cv2.warpAffine(shadow_canvas, M_cast, (W, H))
    cast_sh = cv2.GaussianBlur(cast_sh, (27, 27), 0) * 0.16

    body_recv = cv2.GaussianBlur(body_no_bag.astype(np.float32), (7, 7), 0)
    total_shadow = np.clip((contact_sh + cast_sh) * np.maximum(0.25, body_recv), 0.0, 0.35)[..., None]
    canvas_np = canvas_np * (1.0 - total_shadow)

    # Alpha composite bag onto canvas
    roi = canvas_np[y0:y1, x0:x1]
    a3 = bag_alpha_res[..., None]
    canvas_np[y0:y1, x0:x1] = roi * (1.0 - a3) + bag_rgb_res * a3
    t_inf = time.perf_counter()

    out_u8 = np.clip(canvas_np, 0.0, 255.0).astype(np.uint8)
    if pad_left_hd > 0 and scaled_w_hd < OUTPUT_WIDTH:
        out_u8 = out_u8[:, pad_left_hd : pad_left_hd + scaled_w_hd]

    final_img = Image.fromarray(out_u8, mode="RGB")
    buf = io.BytesIO()
    final_img.save(buf, format="PNG", compress_level=1)
    result_b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    t_end = time.perf_counter()

    return {
        "imageBase64": result_b64,
        "mimeType": "image/png",
        "model": f"CatVTON Accessory-Lock ({OUTPUT_WIDTH}x{OUTPUT_HEIGHT} SCHP · {engine.active_accel})",
        "device": engine.device_name,
        "garmentCacheHit": False,
        "timingsMs": {
            "preprocessMs": round((t_pre - t_start) * 1000.0, 2),
            "inferenceMs": round((t_inf - t_pre) * 1000.0, 2),
            "postprocessMs": round((t_end - t_inf) * 1000.0, 2),
            "totalMs": round((t_end - t_start) * 1000.0, 2),
        },
    }


def _run_tryon_sync(person_bytes: bytes, garment_bytes: bytes, cloth_type: str = "upper") -> dict[str, Any]:
    t_start = time.perf_counter()

    person_raw = _decode_image(person_bytes, "person")
    garment_raw = _decode_image(garment_bytes, "garment")

    normalized_type = (cloth_type or "upper").strip().lower()
    if normalized_type == "bag":
        return _run_bag_tryon_sync(person_raw, garment_raw, t_start)

    assert engine.pipeline is not None and engine.schp_lip is not None and engine.schp_atr is not None
    assert engine.mask_processor is not None

    part = normalized_type if normalized_type in ("upper", "lower", "overall") else "upper"
    is_short_lower = _is_short_lower_garment(garment_raw) if part == "lower" else False

    person_img, _, _ = _prepare_person_canvas(person_raw, (TARGET_WIDTH, TARGET_HEIGHT))
    garment_img = _prepare_garment_canvas(garment_raw, part=part, is_short_lower=is_short_lower)

    raw_mask, head_protect, raw_mask_u8 = _build_schp_masks(
        person_img,
        engine.schp_lip,
        engine.schp_atr,
        part=part,
        is_short_lower=is_short_lower,
    )
    mask = _protect_mask_head(engine.mask_processor.blur(raw_mask, blur_factor=5), head_protect)
    t_pre = time.perf_counter()

    generator = torch.Generator(device="cuda").manual_seed(42)
    with torch.inference_mode():
        result_img = engine.pipeline(
            image=person_img,
            condition_image=garment_img,
            mask=mask,
            num_inference_steps=INFERENCE_STEPS,
            guidance_scale=GUIDANCE_SCALE,
            height=TARGET_HEIGHT,
            width=TARGET_WIDTH,
            generator=generator,
        )[0]
        torch.cuda.synchronize()
    t_inf = time.perf_counter()

    final_img = _composite_preserve_identity(person_raw, result_img, raw_mask_u8, head_protect)
    buf = io.BytesIO()
    final_img.save(buf, format="PNG", compress_level=1)
    result_b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    t_end = time.perf_counter()

    return {
        "imageBase64": result_b64,
        "mimeType": "image/png",
        "model": f"CatVTON ({TARGET_WIDTH}x{TARGET_HEIGHT} -> {OUTPUT_WIDTH}x{OUTPUT_HEIGHT} Face-Lock · {engine.active_accel})",
        "device": engine.device_name,
        "garmentCacheHit": False,
        "timingsMs": {
            "preprocessMs": round((t_pre - t_start) * 1000.0, 2),
            "inferenceMs": round((t_inf - t_pre) * 1000.0, 2),
            "postprocessMs": round((t_end - t_inf) * 1000.0, 2),
            "totalMs": round((t_end - t_start) * 1000.0, 2),
        },
    }


@app.get("/health")
async def health() -> JSONResponse:
    ready = (
        engine.ready_event.is_set()
        and not engine.loading
        and engine.pipeline is not None
        and engine.load_error is None
    )
    status = 200 if ready else 503
    status_label = "ready" if ready else ("loading" if engine.loading else "unavailable")
    return JSONResponse(
        status_code=status,
        content={
            "status": status_label,
            "model": f"CatVTON ({TARGET_WIDTH}x{TARGET_HEIGHT})",
            "cudaAvailable": torch.cuda.is_available(),
            "device": engine.device_name,
            "error": engine.load_error,
        },
    )


@app.post("/try-on")
async def try_on(
    person_image: UploadFile = File(...),
    garment_image: UploadFile = File(...),
    cloth_type: str = Form("upper"),
) -> JSONResponse:
    if engine.loading or not engine.ready_event.is_set():
        deadline = time.monotonic() + 80.0
        while (engine.loading or not engine.ready_event.is_set()) and time.monotonic() < deadline:
            await asyncio.sleep(0.25)

    if not engine.ready_event.is_set() or engine.pipeline is None or engine.load_error is not None:
        detail = (
            "CatVTON model is still warming up. Please try again in a moment."
            if engine.loading
            else (engine.load_error or "CatVTON model is not ready.")
        )
        raise HTTPException(
            status_code=503,
            detail=detail,
        )

    person_bytes = await person_image.read()
    garment_bytes = await garment_image.read()

    try:
        await asyncio.wait_for(engine.semaphore.acquire(), timeout=INFERENCE_TIMEOUT_SEC)
    except asyncio.TimeoutError as exc:
        raise HTTPException(
            status_code=504,
            detail="GPU queue timeout while waiting for previous try-on request.",
        ) from exc

    try:
        result = await asyncio.to_thread(_run_tryon_sync, person_bytes, garment_bytes, cloth_type)
        return JSONResponse(status_code=200, content=result)
    except HTTPException:
        raise
    except RuntimeError as exc:
        if "CUDA" in str(exc).upper() or "OUT OF MEMORY" in str(exc).upper():
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            raise HTTPException(status_code=500, detail=f"GPU runtime error: {exc}") from exc
        raise HTTPException(status_code=500, detail=f"Inference failed: {exc}") from exc
    finally:
        engine.semaphore.release()
