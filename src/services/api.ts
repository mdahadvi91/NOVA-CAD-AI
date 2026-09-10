import { AuthResponse, Project, ProjectVersion, UnitType, DrawingData, ProjectMetadata, SubscriptionStatusResponse } from '../types';

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    try {
      const response = await fetch(endpoint, {
        ...options,
        credentials: 'same-origin',
        headers,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
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
  public async register(
    email: string,
    name: string,
    password: string,
    confirmPassword?: string
  ): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, name, password, confirmPassword: confirmPassword || password }),
    });
  }

  public async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  public async logout(): Promise<void> {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
  }

  public async getMe(): Promise<{ user: AuthResponse['user'] }> {
    return this.request<{ user: AuthResponse['user'] }>('/api/auth/me');
  }

  public async verifyEmail(token: string): Promise<{ message: string; user?: AuthResponse['user'] }> {
    return this.request<{ message: string; user?: AuthResponse['user'] }>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  public async resendVerification(email?: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  public async quickVerify(): Promise<{ message: string; user: AuthResponse['user'] }> {
    return this.request<{ message: string; user: AuthResponse['user'] }>('/api/auth/quick-verify', {
      method: 'POST',
    });
  }

  public async forgotPassword(email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  public async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  }

  public async getSubscriptionStatus(): Promise<SubscriptionStatusResponse> {
    return this.request<SubscriptionStatusResponse>('/api/auth/subscription-status');
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

  public async restoreProjectVersion(id: string, versionId: string): Promise<{ message: string; project: Project; version: ProjectVersion }> {
    return this.request<{ message: string; project: Project; version: ProjectVersion }>(`/api/projects/${id}/restore/${versionId}`, {
      method: 'POST',
    });
  }

  // --- Payment & Billing APIs ---
  public async getPaymentPlans(): Promise<{
    plans: {
      id: string;
      name: string;
      priceCents: number;
      currency: string;
      interval: string;
      description: string;
      aiCreditsIncluded: number;
      features: string[];
    }[];
    creditPacks: {
      id: string;
      name: string;
      priceCents: number;
      currency: string;
      interval: string;
      description: string;
      aiCreditsIncluded: number;
      features: string[];
    }[];
  }> {
    return this.request('/api/payments/plans');
  }

  public async getPaymentHistory(): Promise<{
    tier: string;
    subscriptionStatus: string;
    aiCreditsRemaining: number;
    aiCreditsTotal: number;
    payments: {
      id: string;
      userId: string;
      amountCents: number;
      currency: string;
      status: string;
      provider: string;
      tierGranted?: string;
      creditsGranted: number;
      receiptUrl?: string;
      createdAt: string;
    }[];
  }> {
    return this.request('/api/payments/history');
  }

  public async processCheckout(planId: string): Promise<{
    success: boolean;
    message: string;
    payment: unknown;
    user: unknown;
  }> {
    return this.request('/api/payments/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    });
  }
}

export const api = new ApiService();
