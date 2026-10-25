import { Gamepad2, Disc3, Monitor } from "lucide-react";
import crops from "../../lib/showcase-crops.json";
import frames from "../../lib/case-frames.json";
import { useId } from "react";
import { imageUrl, imageSrcSet } from "../../lib/image-url";
export function caseFrame(image?: string | null) {
  return image
    ? (
        frames as Record<
          string,
          {
            x: number;
            y: number;
            width: number;
            height: number;
            sourceWidth: number;
            sourceHeight: number;
            radius: number;
          }
        >
      )[image]
    : undefined;
}
export function ProductVisual({
  image,
  name,
  type,
  large = false,
  priority = false,
  presentation,
  casePlatform,
}: {
  image?: string | null;
  name: string;
  type: string;
  large?: boolean;
  priority?: boolean;
  presentation?: string;
  casePlatform?: string;
}) {
  const clipId = useId();
  if (image && presentation === "cover")
    return (
      <div
        className={`game-case game-case--${casePlatform?.startsWith("Switch") ? "switch" : casePlatform === "Xbox" ? "xbox" : "playstation"}`}
        role="img"
        aria-label={`${name} physical case preview`}
      >
        <div className="game-case-header">{casePlatform || "GAME"}</div>
        <img
          className="game-case-art"
          src={imageUrl(image, large ? 960 : 640)}
          srcSet={imageSrcSet(image)}
          alt={name}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
        />
      </div>
    );
  // Frame genuine retail cases without changing their artwork or source pixels.
  const frame = caseFrame(image);
  if (image && (frame || image === "catalogue/marvels-spider-man-2-case.png")) {
    const crop = frame || crops["catalogue/marvels-spider-man-2-case.png"];
    return (
      <svg
        className="product-image"
        role="img"
        aria-label={name}
        viewBox={`${crop.x} ${crop.y} ${crop.width} ${crop.height}`}
        overflow="hidden"
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              x={crop.x}
              y={crop.y}
              width={crop.width}
              height={crop.height}
              rx={frame?.radius || 0}
            />
          </clipPath>
        </defs>
        <image
          href={imageUrl(image, large ? 1600 : 640)}
          width={crop.sourceWidth}
          height={crop.sourceHeight}
          clipPath={`url(#${clipId})`}
        />
      </svg>
    );
  }
  return image ? (
    <img
      src={imageUrl(image, large ? 960 : 640)}
      srcSet={imageSrcSet(image)}
      sizes={
        large ? "(max-width:700px) 90vw, 50vw" : "(max-width:700px) 45vw, 25vw"
      }
      alt={name}
      width="800"
      height="650"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className="product-image"
    />
  ) : (
    <div
      className={`asset-placeholder ${type} ${large ? "large" : ""}`}
      aria-label={`${name}: image unavailable`}
    >
      {type === "physical-game" ? (
        <Disc3 strokeWidth={0.7} />
      ) : type === "console" ? (
        <Monitor strokeWidth={0.6} />
      ) : (
        <Gamepad2 strokeWidth={0.7} />
      )}
      <span className="asset-caption">Image unavailable</span>
    </div>
  );
}
