import React, { useEffect, useState, useRef } from "react";

const ScrollProgressBar = () => {
  const [scroll, setScroll] = useState(0);
  const [_tsingWidth, setTsingWidth] = useState(0);
  const tsingRef = useRef();

  // Mettre à jour la progression de scroll
  useEffect(() => {
    const handleScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const current = window.scrollY;
      setScroll(total > 0 ? current / total : 0);
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Mettre à jour la largeur du mot "Tsing"
  useEffect(() => {
    if (tsingRef.current) {
      setTsingWidth(tsingRef.current.offsetWidth);
    }
    const handleResize = () => {
      if (tsingRef.current) {
        setTsingWidth(tsingRef.current.offsetWidth);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Calculer la position horizontale du mot Tsing
  // (désactivé avec le bloc « Mot TSING » commenté plus bas)
  // const winWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
  // const leftPx = Math.max(0, Math.min(scroll * (winWidth - tsingWidth), winWidth - tsingWidth));

  return (
    <div className="pointer-events-none fixed left-0 top-[72px] z-40 h-1 w-full bg-transparent" aria-hidden="true">
      {/* Barre de progression */}
      <div
        className="h-full bg-gradient-to-r from-brand to-[#ff4d4d] transition-all duration-200"
        style={{ width: `${scroll * 100}%` }}
      />

      {/* Mot TSING qui avance */}
      {/* <div
        className="absolute top-4 select-none pointer-events-none"
        style={{
          left: `${leftPx}px`,
          transition: "left 0.2s cubic-bezier(.4,0,.2,1)",
        }}
      >
        <span
          ref={tsingRef}
          className="text-4xl md:text-5xl font-display font-extrabold text-brand-ink drop-shadow-lg bg-white px-2 rounded"
        >
          Tsing
        </span>
      </div> */}
    </div>
  );
};

export default ScrollProgressBar;
