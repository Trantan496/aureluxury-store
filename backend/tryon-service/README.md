# AUREL Local AI Virtual Try-On Service (DM-VTON)

Local GPU inference service powered by [DM-VTON](https://github.com/KiseKloset/DM-VTON) on FastAPI + PyTorch CUDA (`cu128`, Blackwell `sm_120` compatible).

## Hardware & Software Verified
- **GPU**: NVIDIA GeForce RTX 5060 (`sm_120`)
- **Python**: `3.12.10`
- **PyTorch**: `2.11.0+cu128` + `cupy-cuda12x[ctk]` (CUDA 12.9 NVRTC)

## License Notice
DM-VTON code and pretrained weights (`dmvton_pf_warp.pt`, `dmvton_pf_gen.pt`) are licensed under **CC BY-NC-SA 4.0** (non-commercial / academic use). Replace or re-license the model before commercial production deployment.

## Windows Setup & Run
1. Install dependencies and download official checkpoints:
   ```powershell
   .\backend\tryon-service\setup-tryon.ps1
   ```
2. Start the local inference server (binds to `127.0.0.1:8001` only — never exposed publicly):
   ```powershell
   .\backend\tryon-service\start-tryon.ps1
   ```
3. Configure Next.js `.env` (optional if using default port `8001`):
   ```env
   TRYON_SERVICE_URL=http://127.0.0.1:8001
   ```

## Compatibility Fixes Applied to DM-VTON
1. `backend/dm-vton/models/common/correlation.py`: replaced removed `cupy.cuda.compile_with_cache(...)` with `cupy.RawModule(code=...).get_function(...)` for CuPy 14+.
2. `backend/dm-vton/utils/torch_utils.py`: added `weights_only=False` in `torch.load(...)` for PyTorch 2.6+ compatibility with official `.pt` checkpoints.
