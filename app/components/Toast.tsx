"use client";

import React, { useEffect } from "react";

export function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor =
    type === "success"
      ? "bg-green-500"
      : type === "error"
      ? "bg-red-500"
      : "bg-blue-500";
  const icon = type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️";

  return (
    <div
      className={`fixed top-4 right-4 ${bgColor} text-white px-6 py-4 rounded-xl shadow-2xl z-50 animate-slideIn flex items-center gap-3 max-w-md`}
    >
      <span className="text-2xl">{icon}</span>
      <p className="font-semibold">{message}</p>
      <button
        onClick={onClose}
        className="ml-4 text-white/80 hover:text-white text-xl font-bold"
      >
        ×
      </button>
    </div>
  );
}
