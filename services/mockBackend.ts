import { User, ActivityLog, UserRole, WatermarkConfig } from '../types';

const DB_KEY = 'smile_ai_cms_db_v4'; // Version bump
const SESSION_KEY = 'smile_ai_session';

// Extend User for internal DB storage to include password
interface DBUser extends User {
  password?: string; // Optional for migration, but enforced in logic
}

interface Database {
  users: DBUser[];
  logs: ActivityLog[];
  watermark?: WatermarkConfig;
}

const getDB = (): Database => {
  const stored = localStorage.getItem(DB_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  
  // Default Seed Data with specific Admin credentials
  const defaultDB: Database = {
    users: [
      {
        id: 'admin-1',
        username: 'admin',
        password: '@admin2026SMILE',
        role: 'admin',
        isApproved: true,
        createdAt: Date.now(),
      },
      {
        id: 'user-don',
        username: 'Don',
        password: 'donguardo888967',
        role: 'user',
        isApproved: true,
        createdAt: Date.now() - 120000,
      },
      {
        id: 'user-elena',
        username: 'Elena',
        password: 'password123',
        role: 'user',
        isApproved: true,
        createdAt: Date.now() - 250000,
      },
      {
        id: 'user-marcus',
        username: 'Marcus',
        password: 'password123',
        role: 'user',
        isApproved: true,
        createdAt: Date.now() - 400000,
      },
      {
        id: 'user-sophie',
        username: 'Sophie',
        password: 'password123',
        role: 'user',
        isApproved: false, // Pending approval for demo
        createdAt: Date.now() - 800000,
      },
      {
        id: 'user-lucas',
        username: 'Lucas',
        password: 'password123',
        role: 'user',
        isApproved: true,
        createdAt: Date.now() - 1500000,
      }
    ],
    logs: [],
    watermark: {
      enabled: true,
      text: "SMILE AI"
    }
  };
  saveDB(defaultDB);
  return defaultDB;
};

const saveDB = (db: Database) => {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
};

export const authService = {
  login: async (username: string, password: string): Promise<User> => {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 500));
    
    const db = getDB();
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    
    if (!user) throw new Error("Invalid username or password");
    
    // Check password (simple direct comparison for mock)
    if (user.password !== password) {
       throw new Error("Invalid username or password");
    }
    
    // Return user without password
    const { password: _, ...safeUser } = user;
    
    // Simple session management
    localStorage.setItem(SESSION_KEY, JSON.stringify(safeUser));
    return safeUser;
  },

  // Removed public register function
  
  logout: () => {
    localStorage.removeItem(SESSION_KEY);
  },

  getCurrentUser: (): User | null => {
    const stored = localStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  }
};

export const adminService = {
  getUsers: async (): Promise<User[]> => {
    const db = getDB();
    // Return users without passwords
    return db.users.map(({ password, ...user }) => user);
  },

  addUser: async (username: string, password: string, role: UserRole): Promise<User> => {
    await new Promise(r => setTimeout(r, 500));
    const db = getDB();

    if (db.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      throw new Error("Username already taken");
    }

    const newUser: DBUser = {
      id: crypto.randomUUID(),
      username,
      password,
      role,
      isApproved: true, // Admin-created users are auto-approved
      createdAt: Date.now()
    };

    db.users.push(newUser);
    
    // Log creation
    const log: ActivityLog = {
       id: crypto.randomUUID(),
       userId: 'system', 
       username: 'System', 
       action: `Created new user: ${username} (${role})`,
       timestamp: Date.now()
    };
    db.logs.push(log);
    
    saveDB(db);

    const { password: _, ...safeUser } = newUser;
    return safeUser;
  },

  toggleApproval: async (userId: string): Promise<User> => {
    const db = getDB();
    const user = db.users.find(u => u.id === userId);
    if (!user) throw new Error("User not found");
    
    // Prevent removing admin rights from the main admin
    if (user.username === 'admin') return user;

    user.isApproved = !user.isApproved;
    saveDB(db);
    
    const { password: _, ...safeUser } = user;
    return safeUser;
  },

  getLogs: async (): Promise<ActivityLog[]> => {
    return getDB().logs.sort((a, b) => b.timestamp - a.timestamp);
  },

  logActivity: (userId: string, username: string, action: string) => {
    const db = getDB();
    const newLog: ActivityLog = {
      id: crypto.randomUUID(),
      userId,
      username,
      action,
      timestamp: Date.now()
    };
    db.logs.push(newLog);
    // Keep only last 100 logs
    if (db.logs.length > 100) db.logs.shift();
    saveDB(db);
  },

  getWatermarkConfig: async (): Promise<WatermarkConfig> => {
    const db = getDB();
    return db.watermark || { enabled: true, text: "SMILE AI" };
  },

  saveWatermarkConfig: async (config: WatermarkConfig) => {
    const db = getDB();
    db.watermark = config;
    saveDB(db);
  }
};