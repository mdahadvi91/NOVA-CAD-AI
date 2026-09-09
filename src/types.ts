export type UnitType = 'mm' | 'cm' | 'm' | 'in' | 'ft';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  tier?: 'free' | 'pro' | 'enterprise';
  subscriptionStatus?: 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
  aiCreditsRemaining?: number;
  aiCreditsTotal?: number;
  emailVerified?: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  devVerificationToken?: string;
}

export interface SubscriptionStatusResponse {
  tier: 'free' | 'pro' | 'enterprise';
  status: string;
  aiCreditsRemaining: number;
  aiCreditsTotal: number;
  serverAuthorized: boolean;
  capabilities: {
    proCadTools: boolean;
    highPrecisionDxfExport: boolean;
    aiFloorplanGeneration: boolean;
    cloudTeamCollaboration: boolean;
  };
}

export interface ViewState {
  panX: number;
  panY: number;
  zoom: number;
  gridVisible: boolean;
  gridSnap: boolean;
  gridSize: number;
}

export interface Layer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
}

export interface DrawingData {
  objects: unknown[]; // Extensible for Phase 2 DrawingObject
  layers: Layer[];
  viewState: ViewState;
  calibration: {
    originX: number;
    originY: number;
    scaleRefLength: number;
  };
}

export interface ProjectMetadata {
  description?: string;
  gridSpacing?: number;
  snapTolerance?: number;
  precision?: number;
  defaultLayerId?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  units: UnitType;
  status: 'active' | 'archived';
  metadata: ProjectMetadata;
  createdAt: string;
  updatedAt: string;
  currentVersionId?: string;
  drawingData: DrawingData;
}

export interface ProjectVersion {
  id: string;
  projectId: string;
  version: number;
  createdAt: string;
  createdBy: string;
  description: string;
  drawingData: DrawingData;
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export type WorkspaceTool = 'select' | 'pan' | 'zoom-in' | 'zoom-out' | 'fit' | 'calibrate';

export interface CommandLog {
  id: string;
  text: string;
  type: 'input' | 'output' | 'error' | 'system' | 'success';
  timestamp: string;
}
