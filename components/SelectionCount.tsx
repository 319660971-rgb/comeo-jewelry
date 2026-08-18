"use client";

import { useEffect, useState } from "react";
import { readSelection } from "@/lib/selection";

export function SelectionCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(readSelection().length);
    update();
    window.addEventListener("storage", update);
    window.addEventListener("hello-selection-change", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("hello-selection-change", update);
    };
  }, []);
  return <span className="selection-count" aria-label={`${count} selected styles`}>{count}</span>;
}
