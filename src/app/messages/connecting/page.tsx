"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "@/components/chat/chat.module.css";

const REDIRECT_DELAY_MS = 4000;

const CONNECTING_MESSAGES = [
  "Trợ lý thông minh và chuyên viên thời trang đang sẵn sàng đồng hành cùng bạn.",
  "Đang chuẩn bị phòng tư vấn riêng & gợi ý phối đồ chuẩn phong cách AUREL…",
  "Kết nối hoàn tất trong giây lát — chúc bạn trải nghiệm mua sắm thư thái.",
] as const;

/** Custom editorial illustration closely matching the AUREL original artwork. */
function AurelConnectingGraphic() {
  return (
    <div className={styles.connectingGraphicWrap} aria-hidden="true">
      {/* Soft breathing golden aura behind the wreath */}
      <div className={styles.connectingAura} />
      <div className={styles.connectingOrbitRing} />

      <svg
        viewBox="0 0 240 240"
        className={styles.connectingGraphicSvg}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <path id="aurel-connecting-arc" d="M 134 32 A 82 82 0 0 1 198 92" />
          <radialGradient id="petal-fill" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#FFFDF9" />
            <stop offset="100%" stopColor="#DFCBB5" />
          </radialGradient>
          <linearGradient id="skirt-tan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#DFC092" />
            <stop offset="100%" stopColor="#C59D6B" />
          </linearGradient>
          <linearGradient id="navy-dress" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#263759" />
            <stop offset="100%" stopColor="#162138" />
          </linearGradient>
        </defs>

        {/* Animated ambient 4-point stars & sparkles */}
        <path
          d="M42 54 L44 48 L46 54 L52 56 L46 58 L44 64 L42 58 L36 56 Z"
          fill="#B58E6D"
          className={styles.connectingStarA}
        />
        <path
          d="M196 142 L197.8 137 L199.6 142 L204.5 143.8 L199.6 145.6 L197.8 150.5 L196 145.6 L191 143.8 Z"
          fill="#A88264"
          className={styles.connectingStarB}
        />
        <circle cx="172" cy="188" r="2" fill="#C59D6B" className={styles.connectingSparkleC} />
        <circle cx="54" cy="184" r="1.8" fill="#8E6545" className={styles.connectingSparkleA} />

        {/* Curved A U R E L lettering along upper-right arc */}
        <text className={styles.connectingArcText}>
          <textPath href="#aurel-connecting-arc" startOffset="10%">
            A U R E L
          </textPath>
        </text>

        {/* Top 5-petal flower */}
        <g transform="translate(115 30)" className={styles.connectingFlowerPulseA}>
          <ellipse cx="0" cy="-9.5" rx="4.4" ry="7.6" fill="url(#petal-fill)" stroke="#6D4E3A" strokeWidth="0.95" />
          <ellipse cx="9" cy="-3" rx="4.4" ry="7.6" transform="rotate(72 9 -3)" fill="url(#petal-fill)" stroke="#6D4E3A" strokeWidth="0.95" />
          <ellipse cx="5.5" cy="7.8" rx="4.4" ry="7.6" transform="rotate(144 5.5 7.8)" fill="url(#petal-fill)" stroke="#6D4E3A" strokeWidth="0.95" />
          <ellipse cx="-5.5" cy="7.8" rx="4.4" ry="7.6" transform="rotate(216 -5.5 7.8)" fill="url(#petal-fill)" stroke="#6D4E3A" strokeWidth="0.95" />
          <ellipse cx="-9" cy="-3" rx="4.4" ry="7.6" transform="rotate(288 -9 -3)" fill="url(#petal-fill)" stroke="#6D4E3A" strokeWidth="0.95" />
          <circle cx="0" cy="0" r="2.4" fill="#6D4E3A" />
        </g>

        {/* Left curved leafy botanical branch */}
        <g className={styles.connectingFloraGentle}>
          <path d="M52 154 C38 122 40 84 64 54" stroke="#6D4E3A" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M47 136 C34 132 29 121 35 114 C42 119 47 127 47 136 Z" fill="#F2E4D4" stroke="#6D4E3A" strokeWidth="0.95" />
          <path d="M44 114 C31 108 28 96 36 89 C42 95 45 104 44 114 Z" fill="#F2E4D4" stroke="#6D4E3A" strokeWidth="0.95" />
          <path d="M47 92 C36 83 37 71 45 65 C50 73 50 83 47 92 Z" fill="#F2E4D4" stroke="#6D4E3A" strokeWidth="0.95" />
          <path d="M55 74 C57 62 65 56 73 57 C68 65 62 71 55 74 Z" fill="#F2E4D4" stroke="#6D4E3A" strokeWidth="0.95" />
          <path d="M49 124 C56 116 64 114 70 118 C64 124 57 126 49 124 Z" fill="#F2E4D4" stroke="#6D4E3A" strokeWidth="0.95" />
        </g>

        {/* Bottom-left 5-petal flower */}
        <g transform="translate(68 180) scale(0.88)" className={styles.connectingFlowerPulseB}>
          <ellipse cx="0" cy="-9.5" rx="4.4" ry="7.6" fill="url(#petal-fill)" stroke="#6D4E3A" strokeWidth="0.95" />
          <ellipse cx="9" cy="-3" rx="4.4" ry="7.6" transform="rotate(72 9 -3)" fill="url(#petal-fill)" stroke="#6D4E3A" strokeWidth="0.95" />
          <ellipse cx="5.5" cy="7.8" rx="4.4" ry="7.6" transform="rotate(144 5.5 7.8)" fill="url(#petal-fill)" stroke="#6D4E3A" strokeWidth="0.95" />
          <ellipse cx="-5.5" cy="7.8" rx="4.4" ry="7.6" transform="rotate(216 -5.5 7.8)" fill="url(#petal-fill)" stroke="#6D4E3A" strokeWidth="0.95" />
          <ellipse cx="-9" cy="-3" rx="4.4" ry="7.6" transform="rotate(288 -9 -3)" fill="url(#petal-fill)" stroke="#6D4E3A" strokeWidth="0.95" />
          <circle cx="0" cy="0" r="2.3" fill="#6D4E3A" />
        </g>

        {/* Bottom-right 5-petal flower */}
        <g transform="translate(185 152) scale(0.92)" className={styles.connectingFlowerPulseA}>
          <ellipse cx="0" cy="-9.5" rx="4.4" ry="7.6" fill="url(#petal-fill)" stroke="#6D4E3A" strokeWidth="0.95" />
          <ellipse cx="9" cy="-3" rx="4.4" ry="7.6" transform="rotate(72 9 -3)" fill="url(#petal-fill)" stroke="#6D4E3A" strokeWidth="0.95" />
          <ellipse cx="5.5" cy="7.8" rx="4.4" ry="7.6" transform="rotate(144 5.5 7.8)" fill="url(#petal-fill)" stroke="#6D4E3A" strokeWidth="0.95" />
          <ellipse cx="-5.5" cy="7.8" rx="4.4" ry="7.6" transform="rotate(216 -5.5 7.8)" fill="url(#petal-fill)" stroke="#6D4E3A" strokeWidth="0.95" />
          <ellipse cx="-9" cy="-3" rx="4.4" ry="7.6" transform="rotate(288 -9 -3)" fill="url(#petal-fill)" stroke="#6D4E3A" strokeWidth="0.95" />
          <circle cx="0" cy="0" r="2.3" fill="#6D4E3A" />
        </g>

        {/* Bottom curved leafy branch */}
        <g className={styles.connectingFloraSlow}>
          <path d="M96 194 C122 198 148 190 168 174" stroke="#6D4E3A" strokeWidth="1.25" strokeLinecap="round" />
          <path d="M118 194 C122 183 132 179 138 185 C132 193 125 195 118 194 Z" fill="#F2E4D4" stroke="#6D4E3A" strokeWidth="0.95" />
          <path d="M144 187 C150 176 160 174 165 180 C159 187 151 189 144 187 Z" fill="#F2E4D4" stroke="#6D4E3A" strokeWidth="0.95" />
          <path d="M132 195 C138 202 148 202 152 196 C145 191 138 191 132 195 Z" fill="#F2E4D4" stroke="#6D4E3A" strokeWidth="0.95" />
        </g>

        {/* Character closely matching the original reclining figure */}
        <g className={styles.connectingCharacterFloat}>
          {/* Translucent ribbon/wing loops behind shoulders & back */}
          <path
            d="M84 112 C62 98 62 128 84 134 M124 88 C144 72 152 100 132 112 M116 80 C130 62 146 74 134 92"
            stroke="rgba(168, 130, 100, 0.36)"
            strokeWidth="1.3"
            strokeLinecap="round"
          />

          {/* Extending legs & navy knee-high boots */}
          <path d="M138 118 L170 124 L173 130 L141 128 Z" fill="#1C2944" />
          <path d="M168 124 L178 121 L177 131 L170 130 Z" fill="#141E33" />
          <path d="M133 128 L166 135 L168 141 L135 138 Z" fill="#233356" />
          <path d="M164 135 L174 132 L173 142 L166 141 Z" fill="#18233B" />
          {/* Delicate cream boot trim lines */}
          <path d="M148 123 L166 126 M144 133 L162 136" stroke="#E5C89D" strokeWidth="0.9" strokeLinecap="round" opacity="0.7" />

          {/* Billowing champagne-beige ruffled underskirt */}
          <path
            d="M94 128 C84 144 76 162 84 168 C96 172 112 162 126 154 C138 146 146 136 148 126 C134 118 112 118 94 128 Z"
            fill="url(#skirt-tan)"
          />
          <path
            d="M86 160 C98 164 114 156 128 146 C136 140 142 134 145 128"
            stroke="#F5E7D3"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.75"
          />

          {/* Navy layered dress bodice & ruffled overskirt */}
          <path
            d="M98 94 C88 106 86 124 92 142 C108 140 126 128 140 116 C132 104 116 94 98 94 Z"
            fill="url(#navy-dress)"
          />
          {/* Cream-gold ruffled trim lines on the navy dress */}
          <path
            d="M92 118 C104 122 118 116 130 106"
            stroke="#EAD1AB"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M90 132 C106 134 124 124 137 112"
            stroke="#EAD1AB"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M91 142 C108 142 127 131 141 118"
            stroke="#EAD1AB"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* Scalloped cream collar */}
          <path
            d="M90 92 C94 87 104 89 107 96 C100 100 92 98 90 92 Z"
            fill="#FAF3E8"
            stroke="#6D4E3A"
            strokeWidth="0.75"
          />

          {/* Folded arms/hands resting peacefully */}
          <path
            d="M96 102 C104 100 111 104 110 111 C104 114 96 111 94 106 Z"
            fill="#263759"
            stroke="#EAD1AB"
            strokeWidth="1.1"
          />
          <circle cx="109" cy="109" r="3.8" fill="#FBE5DC" stroke="#6D4E3A" strokeWidth="0.6" />

          {/* Dark navy ruffled bonnet/cap with top bow */}
          <path
            d="M74 78 C66 64 78 49 95 54 C103 57 106 67 100 76 Z"
            fill="#19253E"
          />
          <path
            d="M72 64 C66 58 73 50 80 56 C78 61 75 64 72 64 Z"
            fill="#263759"
          />
          <path
            d="M84 52 C87 46 96 48 93 55 C89 56 86 55 84 52 Z"
            fill="#263759"
          />

          {/* Face & bangs */}
          <circle cx="90" cy="75" r="12" fill="#FDE7DF" stroke="#6D4E3A" strokeWidth="0.75" />
          <path
            d="M78 75 C78 65 86 61 95 64 C99 65 101 69 101 74 C95 70 86 70 78 75 Z"
            fill="#1D2230"
          />
          {/* Closed happy eyes, rosy cheeks & gentle smile */}
          <path d="M84 75 Q86.5 77.5 89 75" stroke="#4D372B" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M92 73 Q94.5 75.5 97 73" stroke="#4D372B" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="84.5" cy="79" r="2.1" fill="#F3A296" opacity="0.78" />
          <circle cx="96" cy="77" r="2.1" fill="#F3A296" opacity="0.78" />
          <path d="M90 80 Q92 81.8 93.8 80" stroke="#8C5E4A" strokeWidth="1.05" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}

export default function MessagesConnectingPage() {
  const router = useRouter();
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const redirectTimer = setTimeout(() => {
      router.replace("/messages");
    }, REDIRECT_DELAY_MS);

    const textTimer = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % CONNECTING_MESSAGES.length);
    }, 2000);

    return () => {
      clearTimeout(redirectTimer);
      clearInterval(textTimer);
    };
  }, [router]);

  return (
    <main className={styles.connectingPage} aria-label="Đang chuyển hướng đến phòng tư vấn AUREL">
      {/* Exact S-curve silk corner waves matching AUREL background, gently breathing */}
      <svg
        className={styles.connectingWaveTopSvg}
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0,0 L490,0 C425,105 320,145 200,185 C95,220 40,260 0,340 Z"
          fill="#F5ECE2"
          fillOpacity="0.92"
        />
      </svg>
      <svg
        className={styles.connectingWaveBottomSvg}
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M1440,900 L900,900 C1005,798 1125,765 1232,724 C1328,688 1392,638 1440,560 Z"
          fill="#F5ECE2"
          fillOpacity="0.95"
        />
      </svg>
      <div className={styles.connectingAmbientField} aria-hidden="true">
        <span className={`${styles.connectingPetal} ${styles.connectingPetal1}`} />
        <span className={`${styles.connectingPetal} ${styles.connectingPetal2}`} />
        <span className={`${styles.connectingPetal} ${styles.connectingPetal3}`} />
        <span className={`${styles.connectingPetal} ${styles.connectingPetal4}`} />
        <span className={`${styles.connectingOrb} ${styles.connectingOrb1}`} />
        <span className={`${styles.connectingOrb} ${styles.connectingOrb2}`} />
      </div>

      <section className={styles.connectingStage}>
        <AurelConnectingGraphic />

        <h1 className={styles.connectingTitle}>Bạn đợi một chút nhé</h1>

        <div className={styles.connectingSubtitleViewport} aria-live="polite">
          <p key={messageIndex} className={styles.connectingSubtitle}>
            {CONNECTING_MESSAGES[messageIndex]}
          </p>
        </div>

        <div className={styles.connectingActions}>
          <button
            type="button"
            className={styles.connectingBackBtn}
            onClick={() => router.back()}
          >
            <span aria-hidden="true">←</span>
            <span>Quay lại</span>
          </button>
        </div>

        <div className={styles.connectingProgressTrack} aria-hidden="true">
          <div className={styles.connectingProgressBar} />
        </div>
      </section>
    </main>
  );
}
