// API Service for PHP backend (cPanel/shared hosting friendly)
// Use VITE_API_URL when provided, otherwise default to same-origin /api
const API_BASE_URL = '/api';

interface ApiResponse<T> {
    data?: T;
    error?: string;
    user?: any;
    token?: string;
}

class ApiService {
    private baseUrl: string;
    private token: string | null = null;

    constructor() {
        this.baseUrl = API_BASE_URL;
        this.token = localStorage.getItem('authToken');
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {},
        retryCount: number = 0
    ): Promise<ApiResponse<T>> {
        const url = `${this.baseUrl}${endpoint}`;

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (this.token) {
            (headers as Record<string, string>).Authorization = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers,
            });

            if (response.status === 429) {
                // Too Many Requests: honor Retry-After when available
                const retryAfterHeader = response.headers.get('Retry-After');
                const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
                const retryAfterMs = Number.isFinite(retryAfterSeconds)
                    ? Math.min(Math.max(retryAfterSeconds, 1), 30) * 1000
                    : Math.min(1000 * Math.pow(2, retryCount), 8000);

                if (retryCount < 3) {
                    await new Promise((r) => setTimeout(r, retryAfterMs));
                    return this.request<T>(endpoint, options, retryCount + 1);
                }
                return { error: 'Too many requests. Please try again shortly.' };
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            return { data };
        } catch (error) {
            // Network-level retry (e.g., brief disconnect) with capped backoff
            if (retryCount < 2) {
                const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 4000);
                await new Promise((r) => setTimeout(r, backoffMs));
                return this.request<T>(endpoint, options, retryCount + 1);
            }
            console.error(`API request failed for ${endpoint}:`, error);
            return { error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    // Authentication methods
    async login(identifier: string, password: string): Promise<ApiResponse<any>> {
        const response = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ identifier, password }),
        });

        if (response.data && (response.data as any).token) {
            this.token = (response.data as any).token;
            localStorage.setItem('authToken', this.token!);
        }

        return response;
    }

    async signup(userData: {
        email: string;
        password: string;
        name: string;
        school?: string;
        phone?: string;
        gcashNumber?: string;
    }): Promise<ApiResponse<any>> {
        const response = await this.request('/auth/signup', {
            method: 'POST',
            body: JSON.stringify(userData),
        });

        if (response.data && (response.data as any).token) {
            this.token = (response.data as any).token;
            localStorage.setItem('authToken', this.token!);
        }

        return response;
    }

    logout(): void {
        this.token = null;
        localStorage.removeItem('authToken');
    }

    setToken(token: string): void {
        this.token = token;
        localStorage.setItem('authToken', token);
    }

    // Project methods
    async getProjects(): Promise<ApiResponse<any[]>> {
        return this.request('/projects');
    }

    async createProject(projectData: any): Promise<ApiResponse<any>> {
        return this.request('/projects', {
            method: 'POST',
            body: JSON.stringify(projectData),
        });
    }

    async updateProject(projectId: string, updates: any): Promise<ApiResponse<any>> {
        return this.request(`/projects/${projectId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }

    async deleteProject(projectId: string): Promise<ApiResponse<any>> {
        return this.request(`/projects/${projectId}`, {
            method: 'DELETE',
        });
    }

    // Task methods
    async getTasks(): Promise<ApiResponse<any[]>> {
        return this.request('/tasks');
    }

    async createTask(taskData: any): Promise<ApiResponse<any>> {
        return this.request('/tasks', {
            method: 'POST',
            body: JSON.stringify(taskData),
        });
    }

    async updateTask(taskId: string, updates: any): Promise<ApiResponse<any>> {
        return this.request(`/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }

    async deleteTask(taskId: string): Promise<ApiResponse<any>> {
        return this.request(`/tasks/${taskId}`, {
            method: 'DELETE',
        });
    }

    // Work log methods
    async getWorkLogs(): Promise<ApiResponse<any[]>> {
        return this.request('/worklogs');
    }

    async createWorkLog(workLogData: any): Promise<ApiResponse<any>> {
        return this.request('/worklogs', {
            method: 'POST',
            body: JSON.stringify(workLogData),
        });
    }

    // Materials methods
    async getMaterials(): Promise<ApiResponse<any[]>> {
        return this.request('/materials');
    }

    async createMaterial(materialData: any): Promise<ApiResponse<any>> {
        return this.request('/materials', {
            method: 'POST',
            body: JSON.stringify(materialData),
        });
    }

    // Users methods
    async getUsers(): Promise<ApiResponse<any[]>> {
        return this.request('/users');
    }

    // create supervisor
    async createSupervisor(supervisorData: any): Promise<ApiResponse<any>> {
        return this.request('/users/supervisor', {
            method: 'POST',
            body: JSON.stringify(supervisorData),
        });
    }

    async createClient(clientData: any): Promise<ApiResponse<any>> {
        return this.request('/users/client', {
            method: 'POST',
            body: JSON.stringify(clientData),
        });
    }

    // Health check
    async healthCheck(): Promise<ApiResponse<any>> {
        return this.request('/health');
    }
}

export const apiService = new ApiService();