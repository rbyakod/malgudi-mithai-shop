"use client";

export function PageBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="page-bg__orb page-bg__orb--1" />
      <div className="page-bg__orb page-bg__orb--2" />
      <div className="page-bg__orb page-bg__orb--3" />
      <div className="page-bg__grid" />
      <div className="page-bg__noise" />
    </div>
  );
}
