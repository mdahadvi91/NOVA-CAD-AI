/**
 * Defensive DrawingData validation for NOVA CAD AI Phase 1
 * Validates objects, layers, viewState, calibration against structural limits,
 * finite numbers, maximum sizes, and malformed structures.
 */

import { DrawingData, ViewState } from '../db.js';

export interface ValidationError {
  path: string;
  message: string;
}

export function validateDrawingData(input: unknown): { isValid: boolean; errors: string[]; data?: DrawingData } {
  const errors: string[] = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { isValid: false, errors: ['DrawingData must be a non-null JSON object.'] };
  }

  const raw = input as Record<string, unknown>;

  // 1. Validate Objects Array
  if (!('objects' in raw) || !Array.isArray(raw.objects)) {
    errors.push('drawingData.objects must be an array.');
  } else if (raw.objects.length > 10000) {
    errors.push('drawingData.objects exceeds maximum allowed entity limit (10,000 items).');
  }

  // 2. Validate Layers Array
  const validLayers: DrawingData['layers'] = [];
  if (!('layers' in raw) || !Array.isArray(raw.layers)) {
    errors.push('drawingData.layers must be an array.');
  } else {
    if (raw.layers.length > 50) {
      errors.push('drawingData.layers exceeds maximum allowed layer limit (50 layers).');
    }

    for (let i = 0; i < raw.layers.length; i++) {
      const l = raw.layers[i];
      if (!l || typeof l !== 'object') {
        errors.push(`drawingData.layers[${i}] must be a valid layer object.`);
        continue;
      }
      const id = typeof l.id === 'string' ? l.id.slice(0, 64) : `layer_${i}`;
      const name = typeof l.name === 'string' ? l.name.slice(0, 64) : `Layer ${i}`;
      const color = typeof l.color === 'string' ? l.color.slice(0, 32) : '#06b6d4';
      const visible = typeof l.visible === 'boolean' ? l.visible : true;
      const locked = typeof l.locked === 'boolean' ? l.locked : false;

      validLayers.push({ id, name, color, visible, locked });
    }
  }

  // 3. Validate ViewState
  let validViewState: ViewState = {
    panX: 0,
    panY: 0,
    zoom: 1.0,
    gridVisible: true,
    gridSnap: true,
    gridSize: 20,
  };

  if (raw.viewState && typeof raw.viewState === 'object') {
    const vs = raw.viewState as Record<string, unknown>;
    const panX = Number(vs.panX);
    const panY = Number(vs.panY);
    const zoom = Number(vs.zoom);
    const gridSize = Number(vs.gridSize);

    if (!Number.isFinite(panX) || Math.abs(panX) > 1e7) {
      errors.push('viewState.panX must be a finite coordinate number within reasonable bounds.');
    }
    if (!Number.isFinite(panY) || Math.abs(panY) > 1e7) {
      errors.push('viewState.panY must be a finite coordinate number within reasonable bounds.');
    }
    if (!Number.isFinite(zoom) || zoom <= 0.001 || zoom > 1000) {
      errors.push('viewState.zoom must be a positive finite number between 0.001 and 1000.');
    }
    if (!Number.isFinite(gridSize) || gridSize <= 0 || gridSize > 1000) {
      errors.push('viewState.gridSize must be a positive finite number.');
    }

    validViewState = {
      panX: Number.isFinite(panX) ? panX : 0,
      panY: Number.isFinite(panY) ? panY : 0,
      zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : 1.0,
      gridVisible: Boolean(vs.gridVisible ?? true),
      gridSnap: Boolean(vs.gridSnap ?? true),
      gridSize: Number.isFinite(gridSize) && gridSize > 0 ? gridSize : 20,
    };
  }

  // 4. Validate Calibration
  let validCalibration: DrawingData['calibration'] = {
    originX: 0,
    originY: 0,
    scaleRefLength: 100,
  };

  if (raw.calibration && typeof raw.calibration === 'object') {
    const cal = raw.calibration as Record<string, unknown>;
    const originX = Number(cal.originX);
    const originY = Number(cal.originY);
    const scaleRefLength = Number(cal.scaleRefLength);

    if (!Number.isFinite(originX) || !Number.isFinite(originY)) {
      errors.push('calibration origins must be finite numbers.');
    }
    if (!Number.isFinite(scaleRefLength) || scaleRefLength <= 0) {
      errors.push('calibration scaleRefLength must be a positive finite number.');
    }

    validCalibration = {
      originX: Number.isFinite(originX) ? originX : 0,
      originY: Number.isFinite(originY) ? originY : 0,
      scaleRefLength: Number.isFinite(scaleRefLength) && scaleRefLength > 0 ? scaleRefLength : 100,
    };
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    data: {
      objects: (raw.objects as unknown[]) || [],
      layers: validLayers.length > 0 ? validLayers : [
        { id: 'layer_default', name: 'Default', color: '#06b6d4', visible: true, locked: false }
      ],
      viewState: validViewState,
      calibration: validCalibration,
    },
  };
}
