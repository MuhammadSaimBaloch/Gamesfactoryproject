import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import type { Promotion } from "../../lib/server/storefront";
import { imageUrl, imageSrcSet } from "../../lib/image-url";
export function Promotions({ slides }: { slides: Promotion[] }) {
  const [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [interacting, setInteracting] = useState(false),
    [reduced, setReduced] = useState(true);
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(m.matches);
    update();
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (paused || interacting || reduced || slides.length < 2) return;
    const timer = setInterval(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % slides.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [paused, interacting, reduced, slides.length]);
  if (!slides.length) return null;
  const current = slides[index % slides.length];
  return (
    <section
      className="campaign"
      aria-label="Store highlights"
      aria-roledescription="carousel"
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocusCapture={() => setInteracting(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setInteracting(false);
      }}
    >
      <div className="campaign-copy">
        <span className="eyebrow">GAMES FACTORY / IN THE SPOTLIGHT</span>
        <div aria-live={paused || reduced ? "polite" : "off"}>
          <h2>{current.title}</h2>
          <p>{current.body}</p>
        </div>
        <Link className="button" to={current.href}>
          {current.cta}
          <ArrowRight size={17} />
        </Link>
        {slides.length > 1 && (
          <div className="campaign-controls">
            <button
              className="icon-button outlined"
              aria-label="Previous promotion"
              onClick={() =>
                setIndex((index - 1 + slides.length) % slides.length)
              }
            >
              <ArrowLeft size={18} />
            </button>
            <span>
              {(index % slides.length) + 1} / {slides.length}
            </span>
            <button
              className="icon-button outlined"
              aria-label="Next promotion"
              onClick={() => setIndex((index + 1) % slides.length)}
            >
              <ArrowRight size={18} />
            </button>
            <button
              className="icon-button outlined"
              aria-label={paused ? "Play promotions" : "Pause promotions"}
              onClick={() => setPaused(!paused)}
            >
              {paused ? <Play size={16} /> : <Pause size={16} />}
            </button>
          </div>
        )}
      </div>
      {current.imageKey ? (
        <img
          src={imageUrl(current.imageKey, 960)}
          srcSet={imageSrcSet(current.imageKey)}
          sizes="(max-width:700px) 90vw, 50vw"
          decoding="async"
          alt={current.title}
          loading="lazy"
        />
      ) : (
        <div className="campaign-type" aria-hidden="true">
          PLAY
          <br />
          YOUR
          <br />
          WAY.
        </div>
      )}
    </section>
  );
}
