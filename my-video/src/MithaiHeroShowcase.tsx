import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";

export const mithaiHeroSchema = z.object({
  brandName: z.string(),
});

type ShowcaseProps = z.infer<typeof mithaiHeroSchema>;

type OccasionShot = {
  occasion: string;
  image: string;
  accent: string;
};

const brandSerif =
  '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif';
const uiSans =
  'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const boxShots = {
  hero: staticFile("/images/hero-mithai-box.jpg"),
  kajuBox: staticFile("/images/kaju-katli-box.jpg"),
  assorted: staticFile("/images/assorted-box.jpg"),
};

const textureShots = {
  kaju: staticFile("/images/kaju-katli.jpg"),
  motichoor: staticFile("/images/motichoor-laddoo.jpg"),
  badam: staticFile("/images/badam-barfi.jpg"),
  rose: staticFile("/images/ista-roll.jpg"),
  pista: staticFile("/images/sugarfree-kaju.jpg"),
};

const occasionShots: OccasionShot[] = [
  {
    occasion: "Diwali",
    image: boxShots.hero,
    accent: "#f2bf63",
  },
  {
    occasion: "Rakhi",
    image: boxShots.kajuBox,
    accent: "#d181ff",
  },
  {
    occasion: "Weddings",
    image: boxShots.assorted,
    accent: "#8fc9b6",
  },
  {
    occasion: "Birthdays",
    image: textureShots.rose,
    accent: "#ff9aa8",
  },
  {
    occasion: "Corporate",
    image: textureShots.pista,
    accent: "#89d0c1",
  },
];

const clampConfig = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const cardShadow = "0 48px 120px rgba(5, 8, 17, 0.55)";

const textStyle = {
  color: "#f8e9ca",
  fontFamily: brandSerif,
  letterSpacing: "0.04em",
};

const badgeStyle: React.CSSProperties = {
  border: "1px solid rgba(255, 228, 187, 0.28)",
  borderRadius: 999,
  color: "#f7e4be",
  display: "inline-flex",
  fontFamily: uiSans,
  fontSize: 22,
  letterSpacing: "0.3em",
  padding: "14px 24px",
  textTransform: "uppercase",
};

const overlayGradient =
  "linear-gradient(180deg, rgba(8, 9, 16, 0.04) 0%, rgba(8, 9, 16, 0.58) 100%)";

const totalDurationInFrames = 405;

const FloatingOrb: React.FC<{
  color: string;
  left: number;
  size: number;
  top: number;
}> = ({ color, left, size, top }) => {
  const frame = useCurrentFrame();
  const driftX = interpolate(frame, [0, 405], [0, size * 0.28], clampConfig);
  const driftY = Math.sin((frame + left) / 32) * 18;

  return (
    <div
      style={{
        background: color,
        borderRadius: "50%",
        filter: "blur(26px)",
        height: size,
        left,
        opacity: 0.42,
        position: "absolute",
        top,
        transform: `translate(${driftX}px, ${driftY}px)`,
        width: size,
      }}
    />
  );
};

const BackgroundLayer: React.FC = () => {
  const frame = useCurrentFrame();
  const vignetteOpacity = interpolate(frame, [0, 45, 360, 404], [0.75, 0.9, 0.9, 0.45], clampConfig);

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 18% 20%, rgba(125, 30, 54, 0.42) 0%, transparent 34%), radial-gradient(circle at 83% 26%, rgba(53, 94, 106, 0.34) 0%, transparent 30%), linear-gradient(135deg, #1c1020 0%, #140d14 40%, #0d1720 100%)",
        overflow: "hidden",
      }}
    >
      <FloatingOrb color="rgba(255, 204, 120, 0.55)" left={120} size={150} top={90} />
      <FloatingOrb color="rgba(255, 168, 104, 0.42)" left={1540} size={240} top={130} />
      <FloatingOrb color="rgba(157, 102, 213, 0.36)" left={1490} size={170} top={660} />
      <FloatingOrb color="rgba(227, 183, 114, 0.30)" left={250} size={280} top={710} />

      <div
        style={{
          background:
            "conic-gradient(from 90deg at 50% 50%, rgba(223, 169, 89, 0.16), rgba(255, 255, 255, 0.02), rgba(169, 90, 132, 0.18), rgba(223, 169, 89, 0.16))",
          borderRadius: "50%",
          filter: "blur(12px)",
          height: 520,
          left: -30,
          opacity: 0.42,
          position: "absolute",
          top: 420,
          transform: `rotate(${interpolate(frame, [0, 405], [0, 48], clampConfig)}deg)`,
          width: 520,
        }}
      />

      <div
        style={{
          background:
            "linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(10, 10, 18, 0.12) 30%, rgba(5, 8, 14, 0.72) 100%)",
          bottom: 0,
          height: "48%",
          position: "absolute",
          width: "100%",
        }}
      />

      <div
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(255, 214, 144, 0.18), rgba(255, 214, 144, 0) 60%)",
          borderTop: "1px solid rgba(255, 228, 187, 0.1)",
          bottom: -120,
          height: 390,
          left: -90,
          opacity: 0.95,
          position: "absolute",
          right: -90,
          transform: "perspective(1200px) rotateX(78deg)",
        }}
      />

      <AbsoluteFill
        style={{
          boxShadow: `inset 0 0 220px rgba(0, 0, 0, ${vignetteOpacity})`,
        }}
      />
    </AbsoluteFill>
  );
};

const OverlayText: React.FC<{
  align?: "left" | "right";
  badge: string;
  body?: string;
  subtitle?: string;
  title: string;
  top: number;
}> = ({ align = "left", badge, body, subtitle, title, top }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({
    config: {
      damping: 18,
      mass: 0.8,
      stiffness: 110,
    },
    fps,
    frame,
  });

  const offset = interpolate(entrance, [0, 1], [38, 0]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        maxWidth: 430,
        opacity: entrance,
        position: "absolute",
        right: align === "right" ? 96 : "auto",
        textAlign: align,
        top,
        transform: `translateY(${offset}px)`,
        ...(align === "left" ? { left: 88 } : {}),
      }}
    >
      <div style={badgeStyle}>{badge}</div>
      <div
        style={{
          ...textStyle,
          fontSize: 76,
          fontWeight: 500,
          lineHeight: 1.02,
          textWrap: "balance",
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            color: "rgba(255, 236, 202, 0.86)",
            fontFamily: uiSans,
            fontSize: 25,
            letterSpacing: "0.08em",
            lineHeight: 1.5,
            maxWidth: 360,
            textTransform: "uppercase",
          }}
        >
          {subtitle}
        </div>
      ) : null}
      {body ? (
        <div
          style={{
            color: "rgba(245, 236, 218, 0.8)",
            fontFamily: uiSans,
            fontSize: 28,
            lineHeight: 1.6,
            maxWidth: 390,
          }}
        >
          {body}
        </div>
      ) : null}
    </div>
  );
};

const ProductCard: React.FC<{
  accent?: string;
  image: string;
  imageScaleEnd?: number;
  imageScaleStart?: number;
  left?: number;
  right?: number;
  rotateEnd?: number;
  rotateStart?: number;
  rounded?: number;
  top: number;
}> = ({
  accent = "#f2bf63",
  image,
  imageScaleEnd = 1.08,
  imageScaleStart = 1,
  left,
  right,
  rotateEnd = 0,
  rotateStart = -5,
  rounded = 40,
  top,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [imageScaleStart, imageScaleEnd], clampConfig);
  const rotate = interpolate(frame, [0, durationInFrames], [rotateStart, rotateEnd], clampConfig);
  const translateY = interpolate(
    frame,
    [0, durationInFrames],
    [16, -10],
    {
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      ...clampConfig,
    },
  );

  return (
    <div
      style={{
        background:
          "linear-gradient(180deg, rgba(255, 240, 214, 0.12) 0%, rgba(255, 255, 255, 0.02) 100%)",
        border: `1px solid ${accent}40`,
        borderRadius: rounded,
        boxShadow: cardShadow,
        height: 650,
        left,
        overflow: "hidden",
        position: "absolute",
        right,
        top,
        transform: `translateY(${translateY}px) rotate(${rotate}deg)`,
        width: 650,
      }}
    >
      <Img
        src={image}
        style={{
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
          width: "100%",
        }}
      />
      <div
        style={{
          background: overlayGradient,
          inset: 0,
          position: "absolute",
        }}
      />
    </div>
  );
};

const TextureCard: React.FC<{
  delay: number;
  image: string;
  label: string;
  left: number;
  top: number;
}> = ({ delay, image, label, left, top }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const entrance = spring({
    config: {
      damping: 17,
      mass: 0.9,
      stiffness: 130,
    },
    fps,
    frame: Math.max(0, frame - delay),
  });

  const translateY = interpolate(entrance, [0, 1], [60, 0]);
  const rotate = interpolate(entrance, [0, 1], [delay % 2 === 0 ? -8 : 6, 0]);
  const imageScale = interpolate(
    frame,
    [0, durationInFrames],
    [1.02, 1.12],
    clampConfig,
  );

  return (
    <div
      style={{
        background:
          "linear-gradient(180deg, rgba(255, 240, 214, 0.1) 0%, rgba(255, 255, 255, 0.02) 100%)",
        border: "1px solid rgba(255, 225, 181, 0.18)",
        borderRadius: 34,
        boxShadow: cardShadow,
        height: 310,
        left,
        overflow: "hidden",
        position: "absolute",
        top,
        transform: `translateY(${translateY}px) rotate(${rotate}deg)`,
        width: 290,
      }}
    >
      <Img
        src={image}
        style={{
          height: "100%",
          objectFit: "cover",
          transform: `scale(${imageScale})`,
          width: "100%",
        }}
      />
      <div
        style={{
          background: overlayGradient,
          inset: 0,
          position: "absolute",
        }}
      />
      <div
        style={{
          ...badgeStyle,
          background: "rgba(7, 8, 14, 0.38)",
          bottom: 24,
          fontSize: 16,
          left: 22,
          letterSpacing: "0.22em",
          padding: "10px 14px",
          position: "absolute",
        }}
      >
        {label}
      </div>
    </div>
  );
};

const OccasionMontage: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const index = Math.min(
    occasionShots.length - 1,
    Math.floor(frame / 18),
  );
  const active = occasionShots[index];
  const pulse = spring({
    config: {
      damping: 16,
      stiffness: 120,
    },
    fps,
    frame: frame % 18,
  });

  const scale = interpolate(pulse, [0, 1], [0.96, 1]);
  const opacity = interpolate(frame % 18, [0, 6, 17], [0.25, 1, 0.88], clampConfig);

  return (
    <>
      <OverlayText
        badge="Occasions"
        body="Diwali, Raksha Bandhan, weddings, anniversaries, birthdays and refined corporate hampers."
        subtitle="For Every Indian Occasion"
        title="Thoughtful gifting, framed like a keepsake."
        top={118}
      />

      <div
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02))",
          border: `1px solid ${active.accent}55`,
          borderRadius: 46,
          boxShadow: cardShadow,
          height: 620,
          overflow: "hidden",
          position: "absolute",
          right: 120,
          top: 180,
          transform: `scale(${scale})`,
          width: 620,
        }}
      >
        <Img
          src={active.image}
          style={{
            height: "100%",
            objectFit: "cover",
            opacity,
            transform: `scale(${interpolate(frame, [0, durationInFrames], [1.01, 1.12], clampConfig)})`,
            width: "100%",
          }}
        />
        <div
          style={{
            background: overlayGradient,
            inset: 0,
            position: "absolute",
          }}
        />
        <div
          style={{
            ...badgeStyle,
            background: "rgba(9, 9, 16, 0.36)",
            bottom: 30,
            fontSize: 18,
            left: 28,
            padding: "12px 18px",
            position: "absolute",
          }}
        >
          {active.occasion}
        </div>
      </div>

      {occasionShots.map((shot, shotIndex) => {
        const distance = shotIndex - index;
        if (distance === 0 || Math.abs(distance) > 2) {
          return null;
        }

        return (
          <div
            key={shot.occasion}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${shot.accent}30`,
              borderRadius: 28,
              height: 122,
              overflow: "hidden",
              position: "absolute",
              right: 56 + Math.abs(distance) * 26,
              top: 240 + distance * 154,
              transform: `scale(${1 - Math.abs(distance) * 0.08})`,
              width: 210,
            }}
          >
            <Img
              src={shot.image}
              style={{
                filter: "saturate(0.9) brightness(0.82)",
                height: "100%",
                objectFit: "cover",
                width: "100%",
              }}
            />
          </div>
        );
      })}
    </>
  );
};

export const MithaiHeroShowcase: React.FC<ShowcaseProps> = ({ brandName }) => {
  const frame = useCurrentFrame();
  const fade = interpolate(
    frame,
    [0, 18, totalDurationInFrames - 18, totalDurationInFrames - 1],
    [0, 1, 1, 0],
    clampConfig,
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#120c16", opacity: fade }}>
      <BackgroundLayer />

      <Sequence durationInFrames={90} premountFor={10}>
        <AbsoluteFill>
          <OverlayText
            badge={brandName}
            body="Modern mithai boxes crafted for Diwali gifting, Rakhi rituals, wedding favours and elevated celebrations."
            subtitle="Gifting, Elevated"
            title="Premium Indian sweets, staged like treasure."
            top={98}
          />

          <ProductCard
            accent="#f2bf63"
            image={boxShots.hero}
            imageScaleEnd={1.1}
            left={1110}
            rotateEnd={0}
            rotateStart={-6}
            top={164}
          />

          <div
            style={{
              background: "rgba(255, 236, 202, 0.10)",
              borderRadius: "50%",
              filter: "blur(28px)",
              height: 160,
              position: "absolute",
              right: 210,
              top: 110,
              width: 160,
            }}
          />
        </AbsoluteFill>
      </Sequence>

      <Sequence durationInFrames={75} from={90} premountFor={10}>
        <AbsoluteFill>
          <OverlayText
            badge="Craft"
            body="Kaju katli, motichoor laddoos, pistachio notes and rose-petal finishes in close, tactile detail."
            subtitle="Texture Study"
            title="Gold leaf, pistachio dust and hand-finished sweetness."
            top={118}
          />

          <TextureCard delay={0} image={textureShots.kaju} label="Kaju Katli" left={1040} top={132} />
          <TextureCard delay={8} image={textureShots.motichoor} label="Motichoor" left={1330} top={260} />
          <TextureCard delay={16} image={textureShots.badam} label="Dry Fruit" left={1080} top={520} />
          <TextureCard delay={22} image={textureShots.rose} label="Rose Petals" left={1390} top={560} />
        </AbsoluteFill>
      </Sequence>

      <Sequence durationInFrames={75} from={165} premountFor={10}>
        <AbsoluteFill>
          <OverlayText
            badge="Signature Box"
            body="An overhead reveal of the box interior, arranged with symmetry, jewel-box contrast and warm festive glow."
            subtitle="Overhead Reveal"
            title="Open the lid to a curated assortment."
            top={108}
          />

          <ProductCard
            accent="#8fc9b6"
            image={boxShots.assorted}
            imageScaleEnd={1.06}
            imageScaleStart={0.96}
            right={118}
            rotateEnd={0}
            rotateStart={2}
            rounded={48}
            top={186}
          />
        </AbsoluteFill>
      </Sequence>

      <Sequence durationInFrames={90} from={240} premountFor={10}>
        <AbsoluteFill>
          <OccasionMontage />
        </AbsoluteFill>
      </Sequence>

      <Sequence durationInFrames={75} from={330} premountFor={10}>
        <AbsoluteFill>
          <OverlayText
            align="right"
            badge="Your Mithai Brand"
            body="Refined gifting for festivals, milestones and modern celebrations."
            subtitle="Brand Close"
            title="A premium finish for every celebration."
            top={118}
          />

          <ProductCard
            accent="#f2bf63"
            image={boxShots.kajuBox}
            imageScaleEnd={1.12}
            imageScaleStart={0.98}
            left={116}
            rotateEnd={0}
            rotateStart={5}
            top={160}
          />

          <div
            style={{
              ...badgeStyle,
              background: "rgba(10, 10, 18, 0.36)",
              bottom: 78,
              fontSize: 20,
              left: 118,
              padding: "12px 18px",
              position: "absolute",
            }}
          >
            Gifting, Elevated
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
