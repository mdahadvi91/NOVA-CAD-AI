import React, { useRef, useEffect, useCallback } from 'react';
import { ViewState, UnitType, WorkspaceTool } from '../../types';

interface CadCanvasProps {
  viewState: ViewState;
  onViewStateChange: (next: ViewState | ((prev: ViewState) => ViewState)) => void;
  units: UnitType;
  activeTool: WorkspaceTool;
  onCursorMove: (coords: { worldX: number; worldY: number; screenX: number; screenY: number }) => void;
}

export const CadCanvas: React.FC<CadCanvasProps> = ({
  viewState,
  onViewStateChange,
  units,
  activeTool,
  onCursorMove,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchDistanceRef = useRef<number | null>(null);
  const touchCenterRef = useRef<{ x: number; y: number } | null>(null);

  // Coordinate transformation helpers
  const screenToWorld = useCallback(
    (screenX: number, screenY: number, width: number, height: number, vs: ViewState) => {
      const originScreenX = width / 2 + vs.panX;
      const originScreenY = height / 2 + vs.panY;
      const worldX = (screenX - originScreenX) / vs.zoom;
      // CAD standard: positive Y is up
      const worldY = (originScreenY - screenY) / vs.zoom;
      return { worldX, worldY };
    },
    []
  );

  const worldToScreen = useCallback(
    (worldX: number, worldY: number, width: number, height: number, vs: ViewState) => {
      const originScreenX = width / 2 + vs.panX;
      const originScreenY = height / 2 + vs.panY;
      const screenX = originScreenX + worldX * vs.zoom;
      const screenY = originScreenY - worldY * vs.zoom;
      return { screenX, screenY };
    },
    []
  );

  // Render loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);
    const dpr = window.devicePixelRatio || 1;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Dark CAD drafting background
    ctx.fillStyle = '#090d16'; // Deep blueprint slate
    ctx.fillRect(0, 0, width, height);

    const vs = viewState;
    const originScreenX = width / 2 + vs.panX;
    const originScreenY = height / 2 + vs.panY;

    // --- GRID RENDERING ---
    if (vs.gridVisible) {
      // Calculate dynamic grid step size in world units
      // We want lines to stay between 20px and 120px on screen
      const minScreenSpacing = 25;
      const rawStep = minScreenSpacing / vs.zoom;
      const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
      let step = magnitude;
      if (rawStep / magnitude > 5) {
        step = magnitude * 10;
      } else if (rawStep / magnitude > 2) {
        step = magnitude * 5;
      } else if (rawStep / magnitude > 1) {
        step = magnitude * 2;
      }

      // Visible world bounds
      const topLeft = screenToWorld(0, 0, width, height, vs);
      const bottomRight = screenToWorld(width, height, width, height, vs);

      const startWorldX = Math.floor(Math.min(topLeft.worldX, bottomRight.worldX) / step) * step;
      const endWorldX = Math.ceil(Math.max(topLeft.worldX, bottomRight.worldX) / step) * step;
      const startWorldY = Math.floor(Math.min(topLeft.worldY, bottomRight.worldY) / step) * step;
      const endWorldY = Math.ceil(Math.max(topLeft.worldY, bottomRight.worldY) / step) * step;

      // Draw Grid Lines
      ctx.lineWidth = 1;
      for (let wx = startWorldX; wx <= endWorldX; wx += step) {
        const sx = worldToScreen(wx, 0, width, height, vs).screenX;
        const isMajor = Math.round(wx / (step * 5)) * (step * 5) === Math.round(wx);
        ctx.strokeStyle = isMajor ? 'rgba(71, 85, 105, 0.35)' : 'rgba(51, 65, 85, 0.18)';
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, height);
        ctx.stroke();

        // Coordinate labels along bottom edge
        if (isMajor && vs.zoom > 0.15) {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
          ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
          ctx.fillText(`${wx.toFixed(0)}`, sx + 4, height - 18);
        }
      }

      for (let wy = startWorldY; wy <= endWorldY; wy += step) {
        const sy = worldToScreen(0, wy, width, height, vs).screenY;
        const isMajor = Math.round(wy / (step * 5)) * (step * 5) === Math.round(wy);
        ctx.strokeStyle = isMajor ? 'rgba(71, 85, 105, 0.35)' : 'rgba(51, 65, 85, 0.18)';
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(width, sy);
        ctx.stroke();

        // Coordinate labels along left edge
        if (isMajor && vs.zoom > 0.15) {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
          ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
          ctx.fillText(`${wy.toFixed(0)}`, 6, sy - 4);
        }
      }
    }

    // --- MAIN AXES (X in red tint, Y in green tint) ---
    // X Axis line (Y = 0)
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.65)'; // CAD Red
    ctx.beginPath();
    ctx.moveTo(0, originScreenY);
    ctx.lineTo(width, originScreenY);
    ctx.stroke();

    // Y Axis line (X = 0)
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.65)'; // CAD Green
    ctx.beginPath();
    ctx.moveTo(originScreenX, 0);
    ctx.lineTo(originScreenX, height);
    ctx.stroke();

    // --- WORLD ORIGIN (0, 0) CROSSHAIR & TARGET ---
    ctx.strokeStyle = '#38bdf8'; // Cyan
    ctx.lineWidth = 1.5;
    const crossSize = 14;
    ctx.beginPath();
    ctx.moveTo(originScreenX - crossSize, originScreenY);
    ctx.lineTo(originScreenX + crossSize, originScreenY);
    ctx.moveTo(originScreenX, originScreenY - crossSize);
    ctx.lineTo(originScreenX, originScreenY + crossSize);
    ctx.stroke();

    // Target circle
    ctx.beginPath();
    ctx.arc(originScreenX, originScreenY, 6, 0, Math.PI * 2);
    ctx.stroke();

    // Origin label (0,0)
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 10px ui-monospace, SFMono-Regular, monospace';
    ctx.fillText('(0, 0)', originScreenX + 8, originScreenY - 8);

    // --- PHASE 1 FOUNDATION CALIBRATION TEST GEOMETRY ---
    // Distinctly marked test geometry verifying scale, coordinate transformation, and aspect ratio
    const calW = 200; // 200 units (e.g. mm)
    const calH = 100; // 100 units
    const calOrigin = worldToScreen(0, calH, width, height, vs);
    const calBottomRight = worldToScreen(calW, 0, width, height, vs);
    const boxW = calBottomRight.screenX - calOrigin.screenX;
    const boxH = calBottomRight.screenY - calOrigin.screenY;

    // Outer calibration boundary
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)'; // Cyan
    ctx.strokeRect(calOrigin.screenX, calOrigin.screenY, boxW, boxH);

    // Diagonal calibration line
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.beginPath();
    ctx.moveTo(calOrigin.screenX, calOrigin.screenY + boxH);
    ctx.lineTo(calOrigin.screenX + boxW, calOrigin.screenY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Corner alignment markers
    const mk = 6;
    ctx.strokeStyle = '#38bdf8';
    // Top-left
    ctx.beginPath();
    ctx.moveTo(calOrigin.screenX, calOrigin.screenY + mk);
    ctx.lineTo(calOrigin.screenX, calOrigin.screenY);
    ctx.lineTo(calOrigin.screenX + mk, calOrigin.screenY);
    // Bottom-right
    ctx.moveTo(calOrigin.screenX + boxW - mk, calOrigin.screenY + boxH);
    ctx.lineTo(calOrigin.screenX + boxW, calOrigin.screenY + boxH);
    ctx.lineTo(calOrigin.screenX + boxW, calOrigin.screenY + boxH - mk);
    ctx.stroke();

    // Calibration text annotation
    if (vs.zoom > 0.25) {
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
      ctx.fillText(
        `CALIBRATION GEOMETRY (${calW} x ${calH} ${units})`,
        calOrigin.screenX + 8,
        calOrigin.screenY + 18
      );

      ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
      ctx.font = '9px ui-monospace, SFMono-Regular, monospace';
      ctx.fillText(
        `[Phase 1 Foundation Test Surface • 1 unit = 1 ${units}]`,
        calOrigin.screenX + 8,
        calOrigin.screenY + 32
      );
    }

    // --- WORKSPACE HUD OVERLAY ---
    // Bottom-left scale bar
    const barScreenLength = 100; // 100px
    const barWorldLength = barScreenLength / vs.zoom;
    const barX = 20;
    const barY = height - 25;

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(barX, barY - 4);
    ctx.lineTo(barX, barY);
    ctx.lineTo(barX + barScreenLength, barY);
    ctx.lineTo(barX + barScreenLength, barY - 4);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
    ctx.fillText(`${barWorldLength.toFixed(1)} ${units}`, barX + 6, barY - 6);

    ctx.restore();
  }, [viewState, units, screenToWorld, worldToScreen]);

  // Handle Resize via ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      draw();
    };

    const observer = new ResizeObserver(() => {
      resize();
    });

    observer.observe(container);
    resize();

    return () => observer.disconnect();
  }, [draw]);

  // Redraw when viewState or units change
  useEffect(() => {
    draw();
  }, [draw]);

  // --- MOUSE & WHEEL EVENTS ---
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;

    onViewStateChange((prev) => {
      const nextZoom = Math.min(Math.max(prev.zoom * zoomFactor, 0.05), 50);
      // Zoom centered on cursor position:
      // screenX = originX + worldX * zoom
      // mouseX - originX_new = (mouseX - originX_old) * (nextZoom / prevZoom)
      const width = rect.width;
      const height = rect.height;

      const originX = width / 2 + prev.panX;
      const originY = height / 2 + prev.panY;

      const newOriginX = mouseX - (mouseX - originX) * (nextZoom / prev.zoom);
      const newOriginY = mouseY - (mouseY - originY) * (nextZoom / prev.zoom);

      return {
        ...prev,
        zoom: nextZoom,
        panX: newOriginX - width / 2,
        panY: newOriginY - height / 2,
      };
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Pan on middle click (button 1) OR space pressed OR pan tool
    if (e.button === 1 || activeTool === 'pan' || e.button === 0) {
      isDraggingRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Dispatch cursor coordinate update
    const { worldX, worldY } = screenToWorld(
      screenX,
      screenY,
      rect.width,
      rect.height,
      viewState
    );
    onCursorMove({ worldX, worldY, screenX, screenY });

    if (isDraggingRef.current) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };

      onViewStateChange((prev) => ({
        ...prev,
        panX: prev.panX + dx,
        panY: prev.panY + dy,
      }));
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // --- TOUCH SUPPORT (Mobile & Tablet Gestures) ---
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      lastMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      isDraggingRef.current = false;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchDistanceRef.current = dist;
      touchCenterRef.current = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (e.touches.length === 1 && isDraggingRef.current) {
      const t = e.touches[0];
      const dx = t.clientX - lastMousePosRef.current.x;
      const dy = t.clientY - lastMousePosRef.current.y;
      lastMousePosRef.current = { x: t.clientX, y: t.clientY };

      // Update cursor coordinate
      const screenX = t.clientX - rect.left;
      const screenY = t.clientY - rect.top;
      const { worldX, worldY } = screenToWorld(
        screenX,
        screenY,
        rect.width,
        rect.height,
        viewState
      );
      onCursorMove({ worldX, worldY, screenX, screenY });

      onViewStateChange((prev) => ({
        ...prev,
        panX: prev.panX + dx,
        panY: prev.panY + dy,
      }));
    } else if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const newDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = newDist / touchDistanceRef.current;
      touchDistanceRef.current = newDist;

      const center = {
        x: (t1.clientX + t2.clientX) / 2 - rect.left,
        y: (t1.clientY + t2.clientY) / 2 - rect.top,
      };

      onViewStateChange((prev) => {
        const nextZoom = Math.min(Math.max(prev.zoom * ratio, 0.05), 50);
        const originX = rect.width / 2 + prev.panX;
        const originY = rect.height / 2 + prev.panY;

        const newOriginX = center.x - (center.x - originX) * (nextZoom / prev.zoom);
        const newOriginY = center.y - (center.y - originY) * (nextZoom / prev.zoom);

        return {
          ...prev,
          zoom: nextZoom,
          panX: newOriginX - rect.width / 2,
          panY: newOriginY - rect.height / 2,
        };
      });
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    touchDistanceRef.current = null;
    touchCenterRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      id="cad-canvas-container"
      className="relative w-full h-full select-none overflow-hidden bg-slate-950 touch-none"
    >
      <canvas
        ref={canvasRef}
        id="cad-viewport-canvas"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`w-full h-full block ${
          activeTool === 'pan' || isDraggingRef.current
            ? 'cursor-grab active:cursor-grabbing'
            : 'cursor-crosshair'
        }`}
      />
    </div>
  );
};
