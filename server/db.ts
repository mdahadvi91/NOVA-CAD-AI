import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  name: string;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export type UnitType = 'mm' | 'cm' | 'm' | 'in' | 'ft';

export interface ViewState {
  panX: number;
  panY: number;
  zoom: number;
  gridVisible: boolean;
  gridSnap: boolean;
  gridSize: number;
}

export interface DrawingData {
  objects: unknown[]; // Placeholder for Phase 2 DrawingObject
  layers: {
    id: string;
    name: string;
    color: string;
    visible: boolean;
    locked: boolean;
  }[];
  viewState: ViewState;
  calibration: {
    originX: number;
    originY: number;
    scaleRefLength: number;
  };
}

export interface ProjectMetadata {
  description?: string;
  tags?: string[];
  gridSpacing?: number;
  snapTolerance?: number;
  defaultLayerId?: string;
  precision?: number;
  lastEditedBy?: string;
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

// Extensible schemas for future phases (Phase 2+)
export interface DrawingObject {
  id: string;
  projectId: string;
  layerId: string;
  type: string;
  properties: Record<string, unknown>;
  createdAt: string;
}

export interface Layer {
  id: string;
  projectId: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
}

export interface AIRequest {
  id: string;
  projectId: string;
  userId: string;
  prompt: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

export interface AIUsage {
  id: string;
  userId: string;
  tokensUsed: number;
  feature: string;
  timestamp: string;
}

export interface ExportJob {
  id: string;
  projectId: string;
  format: 'dxf' | 'dwg' | 'pdf' | 'svg';
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'canceled';
  expiresAt: string;
}

export interface DatabaseSchema {
  users: Record<string, User>;
  projects: Record<string, Project>;
  projectVersions: Record<string, ProjectVersion[]>;
  // Future collections
  drawingObjects: Record<string, DrawingObject[]>;
  layers: Record<string, Layer[]>;
  aiRequests: Record<string, AIRequest[]>;
  aiUsage: Record<string, AIUsage[]>;
  exportJobs: Record<string, ExportJob[]>;
  subscriptions: Record<string, Subscription>;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'nova_cad_db.json');

class Database {
  private data: DatabaseSchema;
  private isInitialized = false;

  constructor() {
    this.data = this.getDefaultSchema();
  }

  private getDefaultSchema(): DatabaseSchema {
    return {
      users: {},
      projects: {},
      projectVersions: {},
      drawingObjects: {},
      layers: {},
      aiRequests: {},
      aiUsage: {},
      exportJobs: {},
      subscriptions: {},
    };
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          ...this.getDefaultSchema(),
          ...parsed,
        };
      } catch (err) {
        console.error('Failed to parse database file, initializing fresh schema', err);
        this.data = this.getDefaultSchema();
        this.seedDemoUser();
        await this.persist();
      }
    } else {
      this.data = this.getDefaultSchema();
      this.seedDemoUser();
      await this.persist();
    }

    // Ensure demo user exists if users is empty
    if (Object.keys(this.data.users).length === 0) {
      this.seedDemoUser();
      await this.persist();
    }

    this.isInitialized = true;
  }

  private seedDemoUser(): void {
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = crypto.pbkdf2Sync('password123', salt, 1000, 64, 'sha512').toString('hex');
    const demoUser: User = {
      id: 'usr_demo_nova',
      email: 'demo@novacad.ai',
      passwordHash,
      salt,
      name: 'Architect Demo',
      role: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.users[demoUser.id] = demoUser;

    // Seed a sample project for the demo user
    const sampleProjectId = 'prj_foundation_sample';
    const sampleDrawingData: DrawingData = {
      objects: [],
      layers: [
        { id: 'layer_0', name: '0 - General', color: '#00ffff', visible: true, locked: false },
        { id: 'layer_walls', name: 'A-WALL (Walls)', color: '#ffffff', visible: true, locked: false },
        { id: 'layer_dims', name: 'A-DIMS (Dimensions)', color: '#ffb020', visible: true, locked: false },
      ],
      viewState: {
        panX: 0,
        panY: 0,
        zoom: 1.0,
        gridVisible: true,
        gridSnap: true,
        gridSize: 20,
      },
      calibration: {
        originX: 0,
        originY: 0,
        scaleRefLength: 1000,
      },
    };

    const sampleProject: Project = {
      id: sampleProjectId,
      ownerId: demoUser.id,
      name: 'Nova Architectural Prototype A-101',
      description: 'Phase 1 baseline workspace floorplan layout and coordinate calibration.',
      units: 'mm',
      status: 'active',
      metadata: {
        gridSpacing: 20,
        snapTolerance: 10,
        precision: 2,
        defaultLayerId: 'layer_0',
      },
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      updatedAt: new Date().toISOString(),
      currentVersionId: 'ver_sample_1',
      drawingData: sampleDrawingData,
    };

    this.data.projects[sampleProject.id] = sampleProject;
    this.data.projectVersions[sampleProjectId] = [
      {
        id: 'ver_sample_1',
        projectId: sampleProjectId,
        version: 1,
        createdAt: new Date().toISOString(),
        createdBy: demoUser.id,
        description: 'Initial Phase 1 Workspace Foundation Setup',
        drawingData: sampleDrawingData,
      },
    ];
  }

  private async persist(): Promise<void> {
    const tmpFile = `${DB_FILE}.tmp`;
    const payload = JSON.stringify(this.data, null, 2);
    await fs.promises.writeFile(tmpFile, payload, 'utf-8');
    await fs.promises.rename(tmpFile, DB_FILE);
  }

  // --- USER METHODS ---
  public async findUserByEmail(email: string): Promise<User | null> {
    await this.init();
    const normalized = email.trim().toLowerCase();
    const user = Object.values(this.data.users).find(
      (u) => u.email.toLowerCase() === normalized
    );
    return user || null;
  }

  public async findUserById(id: string): Promise<User | null> {
    await this.init();
    return this.data.users[id] || null;
  }

  public async createUser(userData: {
    email: string;
    passwordHash: string;
    salt: string;
    name: string;
  }): Promise<User> {
    await this.init();
    const id = `usr_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();
    const user: User = {
      id,
      email: userData.email.trim().toLowerCase(),
      passwordHash: userData.passwordHash,
      salt: userData.salt,
      name: userData.name.trim(),
      role: 'user',
      createdAt: now,
      updatedAt: now,
    };
    this.data.users[id] = user;
    await this.persist();
    return user;
  }

  // --- PROJECT METHODS ---
  public async getProjectsForUser(userId: string): Promise<Project[]> {
    await this.init();
    return Object.values(this.data.projects)
      .filter((p) => p.ownerId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public async getProjectById(projectId: string): Promise<Project | null> {
    await this.init();
    return this.data.projects[projectId] || null;
  }

  public async createProject(data: {
    ownerId: string;
    name: string;
    description?: string;
    units?: UnitType;
    metadata?: ProjectMetadata;
  }): Promise<Project> {
    await this.init();
    const id = `prj_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();
    const units = data.units || 'mm';

    const defaultDrawingData: DrawingData = {
      objects: [],
      layers: [
        { id: 'layer_0', name: '0 - Standard', color: '#00e5ff', visible: true, locked: false },
        { id: 'layer_geom', name: 'A-GEOM', color: '#ffffff', visible: true, locked: false },
      ],
      viewState: {
        panX: 0,
        panY: 0,
        zoom: 1.0,
        gridVisible: true,
        gridSnap: true,
        gridSize: units === 'm' ? 1 : units === 'ft' ? 1 : 20,
      },
      calibration: {
        originX: 0,
        originY: 0,
        scaleRefLength: units === 'm' ? 10 : 1000,
      },
    };

    const initialVersionId = `ver_${crypto.randomBytes(8).toString('hex')}`;
    const project: Project = {
      id,
      ownerId: data.ownerId,
      name: data.name.trim(),
      description: data.description?.trim() || '',
      units,
      status: 'active',
      metadata: {
        gridSpacing: units === 'm' ? 1 : 20,
        snapTolerance: 10,
        precision: 2,
        ...data.metadata,
      },
      createdAt: now,
      updatedAt: now,
      currentVersionId: initialVersionId,
      drawingData: defaultDrawingData,
    };

    this.data.projects[id] = project;
    this.data.projectVersions[id] = [
      {
        id: initialVersionId,
        projectId: id,
        version: 1,
        createdAt: now,
        createdBy: data.ownerId,
        description: 'Initial Project Creation',
        drawingData: defaultDrawingData,
      },
    ];

    await this.persist();
    return project;
  }

  public async updateProject(
    projectId: string,
    updates: {
      name?: string;
      description?: string;
      units?: UnitType;
      metadata?: ProjectMetadata;
      drawingData?: DrawingData;
    }
  ): Promise<Project | null> {
    await this.init();
    const project = this.data.projects[projectId];
    if (!project) return null;

    const now = new Date().toISOString();
    if (updates.name !== undefined) project.name = updates.name.trim();
    if (updates.description !== undefined) project.description = updates.description.trim();
    if (updates.units !== undefined) project.units = updates.units;
    if (updates.metadata !== undefined) {
      project.metadata = { ...project.metadata, ...updates.metadata };
    }
    if (updates.drawingData !== undefined) {
      project.drawingData = updates.drawingData;
    }
    project.updatedAt = now;

    await this.persist();
    return project;
  }

  public async deleteProject(projectId: string): Promise<boolean> {
    await this.init();
    if (!this.data.projects[projectId]) return false;

    delete this.data.projects[projectId];
    delete this.data.projectVersions[projectId];
    delete this.data.drawingObjects[projectId];
    delete this.data.layers[projectId];

    await this.persist();
    return true;
  }

  public async duplicateProject(projectId: string, newOwnerId: string): Promise<Project | null> {
    await this.init();
    const source = this.data.projects[projectId];
    if (!source) return null;

    const newId = `prj_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();
    const newVersionId = `ver_${crypto.randomBytes(8).toString('hex')}`;

    const newProject: Project = {
      ...JSON.parse(JSON.stringify(source)),
      id: newId,
      ownerId: newOwnerId,
      name: `${source.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
      currentVersionId: newVersionId,
    };

    this.data.projects[newId] = newProject;
    this.data.projectVersions[newId] = [
      {
        id: newVersionId,
        projectId: newId,
        version: 1,
        createdAt: now,
        createdBy: newOwnerId,
        description: `Duplicated from ${source.name}`,
        drawingData: JSON.parse(JSON.stringify(source.drawingData)),
      },
    ];

    await this.persist();
    return newProject;
  }

  public async saveProjectVersion(
    projectId: string,
    userId: string,
    drawingData: DrawingData,
    description = 'Manual save'
  ): Promise<{ project: Project; version: ProjectVersion } | null> {
    await this.init();
    const project = this.data.projects[projectId];
    if (!project) return null;

    const now = new Date().toISOString();
    const versions = this.data.projectVersions[projectId] || [];
    const nextVersionNum = versions.length > 0 ? Math.max(...versions.map((v) => v.version)) + 1 : 1;

    const newVersionId = `ver_${crypto.randomBytes(8).toString('hex')}`;
    const newVersion: ProjectVersion = {
      id: newVersionId,
      projectId,
      version: nextVersionNum,
      createdAt: now,
      createdBy: userId,
      description,
      drawingData: JSON.parse(JSON.stringify(drawingData)),
    };

    versions.push(newVersion);
    this.data.projectVersions[projectId] = versions;

    project.drawingData = drawingData;
    project.currentVersionId = newVersionId;
    project.updatedAt = now;

    await this.persist();
    return { project, version: newVersion };
  }

  public async getProjectVersions(projectId: string): Promise<ProjectVersion[]> {
    await this.init();
    return (this.data.projectVersions[projectId] || []).sort((a, b) => b.version - a.version);
  }
}

export const db = new Database();
