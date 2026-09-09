import { AuthResponse, Project, ProjectVersion, UnitType, DrawingData, ProjectMetadata } from '../types';

const TOKEN_KEY = 'nova_cad_token';

class ApiService {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem(TOKEN_KEY);
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  public setToken(token: string | null): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          // Token invalid or expired
          this.setToken(null);
        }
        const errorMsg = data?.error || `Request failed with status ${response.status}`;
        throw new Error(errorMsg);
      }

      return data as T;
    } catch (err: unknown) {
      if (err instanceof Error) {
        throw err;
      }
      throw new Error('An unexpected network error occurred. Please check your connection.');
    }
  }

  // --- AUTH METHODS ---
  public async register(email: string, name: string, password: string): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, name, password }),
    });
    this.setToken(res.token);
    return res;
  }

  public async login(email: string, password: string): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.token);
    return res;
  }

  public async getMe(): Promise<{ user: AuthResponse['user'] }> {
    return this.request<{ user: AuthResponse['user'] }>('/api/auth/me');
  }

  public logout(): void {
    this.setToken(null);
  }

  // --- PROJECT METHODS ---
  public async getProjects(): Promise<{ projects: Project[] }> {
    return this.request<{ projects: Project[] }>('/api/projects');
  }

  public async getProject(id: string): Promise<{ project: Project }> {
    return this.request<{ project: Project }>(`/api/projects/${id}`);
  }

  public async createProject(data: {
    name: string;
    description?: string;
    units?: UnitType;
    metadata?: ProjectMetadata;
  }): Promise<{ project: Project }> {
    return this.request<{ project: Project }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async updateProject(
    id: string,
    updates: {
      name?: string;
      description?: string;
      units?: UnitType;
      metadata?: ProjectMetadata;
      drawingData?: DrawingData;
    }
  ): Promise<{ project: Project }> {
    return this.request<{ project: Project }>(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  public async deleteProject(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/projects/${id}`, {
      method: 'DELETE',
    });
  }

  public async duplicateProject(id: string): Promise<{ project: Project }> {
    return this.request<{ project: Project }>(`/api/projects/${id}/duplicate`, {
      method: 'POST',
    });
  }

  public async saveProjectVersion(
    id: string,
    drawingData: DrawingData,
    description?: string
  ): Promise<{ message: string; project: Project; version: ProjectVersion }> {
    return this.request<{ message: string; project: Project; version: ProjectVersion }>(
      `/api/projects/${id}/save`,
      {
        method: 'POST',
        body: JSON.stringify({ drawingData, description }),
      }
    );
  }

  public async getProjectVersions(id: string): Promise<{ versions: ProjectVersion[] }> {
    return this.request<{ versions: ProjectVersion[] }>(`/api/projects/${id}/versions`);
  }
}

export const api = new ApiService();
