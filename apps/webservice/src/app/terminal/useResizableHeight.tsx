import { useCallback, useEffect, useRef, useState } from "react";

export const useResizableHeight = (
  initialHeight: number,
  minHeight: number,
) => {
  const [height, setHeight] = useState(initialHeight);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  const handleMouseDown = useCallback<React.MouseEventHandler<HTMLDivElement>>(
    (e) => {
      setIsDragging(true);
      dragStartY.current = e.clientY;
      dragStartHeight.current = height;
    },
    [height],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaY = dragStartY.current - e.clientY;
      const newHeight = Math.max(minHeight, dragStartHeight.current + deltaY);
      setHeight(newHeight);
    },
    [isDragging, minHeight],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return { height, handleMouseDown };
};
