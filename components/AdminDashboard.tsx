import React, { useEffect, useState } from 'react';
import { adminService } from '../services/mockBackend';
import { User, ActivityLog, UserRole, WatermarkConfig } from '../types';
import { Button } from './Button';
import { Alert } from './Alert';

interface AdminDashboardProps {
  hasApiKey: boolean;
  onConnectKey: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ hasApiKey, onConnectKey }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [watermarkConfig, setWatermarkConfig] = useState<WatermarkConfig>({ enabled: true, text: '' });
  const [loading, setLoading] = useState(true);

  // New User Form State
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('user');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [creationSuccess, setCreationSuccess] = useState<string | null>(null);
  
  // Watermark Form State
  const [isSavingWatermark, setIsSavingWatermark] = useState(false);
  const [watermarkSuccess, setWatermarkSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [fetchedUsers, fetchedLogs, fetchedWatermark] = await Promise.all([
        adminService.getUsers(),
        adminService.getLogs(),
        adminService.getWatermarkConfig()
      ]);
      setUsers(fetchedUsers);
      setLogs(fetchedLogs);
      setWatermarkConfig(fetchedWatermark);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleApproval = async (userId: string) => {
    try {
      await adminService.toggleApproval(userId);
      await fetchData(); // Refresh data
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserUsername.trim() || !newUserPassword.trim()) return;

    setIsCreatingUser(true);
    setCreationError(null);
    setCreationSuccess(null);

    try {
      await adminService.addUser(newUserUsername, newUserPassword, newUserRole);
      setCreationSuccess(`User ${newUserUsername} created successfully.`);
      setNewUserUsername('');
      setNewUserPassword('');
      setNewUserRole('user');
      await fetchData();
    } catch (err: any) {
      setCreationError(err.message || "Failed to create user");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleSaveWatermark = async () => {
    setIsSavingWatermark(true);
    setWatermarkSuccess(null);
    try {
      await adminService.saveWatermarkConfig(watermarkConfig);
      await adminService.logActivity('admin', 'Admin', `Updated watermark settings`);
      setWatermarkSuccess("Watermark configuration saved.");
      setTimeout(() => setWatermarkSuccess(null), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingWatermark(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Loading CMS Data...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-10">
      
      {/* System Configuration (API Key) */}
      <div className={`rounded-2xl shadow-sm border overflow-hidden p-6 flex flex-col sm:flex-row items-center justify-between gap-6 ${
        hasApiKey 
          ? 'bg-emerald-50 border-emerald-100' 
          : 'bg-indigo-50 border-indigo-100'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${hasApiKey ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
             </svg>
          </div>
          <div>
            <h2 className={`text-lg font-bold ${hasApiKey ? 'text-emerald-900' : 'text-indigo-900'}`}>
              System Configuration
            </h2>
            <p className={`text-sm mt-1 ${hasApiKey ? 'text-emerald-700' : 'text-indigo-700'}`}>
              {hasApiKey 
                ? 'Google Cloud API is connected and active. The video generation service is online.' 
                : 'Connection to Google Cloud is required for video generation services.'}
            </p>
          </div>
        </div>
        <div>
          <Button 
            onClick={onConnectKey} 
            className={`!py-2 !px-4 !text-sm whitespace-nowrap ${
              hasApiKey ? '!bg-white !text-emerald-700 !border-emerald-200 hover:!bg-emerald-50' : ''
            }`}
            variant={hasApiKey ? 'outline' : 'primary'}
          >
            {hasApiKey ? 'Re-configure API Key' : 'Connect Google Cloud API'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Branding & Watermark */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-200 bg-slate-50">
             <h2 className="text-lg font-bold text-slate-800">Branding & Watermark</h2>
             <p className="text-sm text-slate-500">Configure public facing branding.</p>
          </div>
          <div className="p-6 flex-grow flex flex-col justify-between">
             {watermarkSuccess && <Alert type="info" message={watermarkSuccess} onClose={() => setWatermarkSuccess(null)} />}
             
             <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <span className="text-sm font-medium text-slate-700">Enable Watermark</span>
                   <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={watermarkConfig.enabled}
                        onChange={(e) => setWatermarkConfig({...watermarkConfig, enabled: e.target.checked})}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                   </label>
                </div>
                
                <div>
                   <label className="block text-xs font-semibold text-slate-600 mb-1">Watermark Text</label>
                   <input 
                      type="text" 
                      value={watermarkConfig.text}
                      onChange={(e) => setWatermarkConfig({...watermarkConfig, text: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-base disabled:opacity-50 disabled:bg-slate-50"
                      placeholder="e.g. SMILE AI"
                      disabled={!watermarkConfig.enabled}
                   />
                </div>
             </div>
             
             <div className="mt-6 pt-4 border-t border-slate-100">
                <Button 
                   onClick={handleSaveWatermark} 
                   isLoading={isSavingWatermark}
                   className="w-full"
                   variant="secondary"
                >
                   Save Branding
                </Button>
             </div>
          </div>
        </div>

        {/* Demo Credentials Reference */}
        <div className="bg-slate-100 rounded-2xl p-6 border border-slate-200">
           <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">Demo Credentials Reference</h3>
           <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                 <div className="font-semibold text-indigo-600">admin</div>
                 <div className="text-slate-500 font-mono mt-1 break-all">@admin2026SMILE</div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                 <div className="font-semibold text-indigo-600">Don</div>
                 <div className="text-slate-500 font-mono mt-1 break-all">donguardo888967</div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                 <div className="font-semibold text-slate-700">Elena</div>
                 <div className="text-slate-500 font-mono mt-1 break-all">password123</div>
              </div>
               <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                 <div className="font-semibold text-slate-700">Sophie</div>
                 <div className="text-slate-500 font-mono mt-1 break-all">password123</div>
                 <div className="text-amber-600 text-[10px] mt-1">(Pending)</div>
              </div>
           </div>
        </div>
      </div>

      {/* Create User Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
           <h2 className="text-lg font-bold text-slate-800">Create New User</h2>
           <p className="text-sm text-slate-500">Add a new user or admin to the system.</p>
        </div>
        <div className="p-6">
           {creationError && <Alert type="error" message={creationError} onClose={() => setCreationError(null)} />}
           {creationSuccess && <Alert type="info" message={creationSuccess} onClose={() => setCreationSuccess(null)} />}
           
           <form onSubmit={handleCreateUser} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Username</label>
                <input 
                  type="text" 
                  value={newUserUsername}
                  onChange={(e) => setNewUserUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-base"
                  placeholder="New username"
                  required
                />
              </div>
              <div className="flex-1 w-full">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
                <input 
                  type="text" 
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-base"
                  placeholder="Set password"
                  required
                />
              </div>
              <div className="w-full md:w-32">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Role</label>
                <select 
                   value={newUserRole}
                   onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                   className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-base"
                >
                   <option value="user">User</option>
                   <option value="admin">Admin</option>
                </select>
              </div>
              <Button type="submit" isLoading={isCreatingUser} className="w-full md:w-auto">
                Add User
              </Button>
           </form>
        </div>
      </div>

      {/* User List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-800">User Management</h2>
            <p className="text-sm text-slate-500">Manage existing access.</p>
          </div>
          <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wide">
            {users.length} Users
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">User</th>
                <th className="px-6 py-4 font-semibold">Role</th>
                <th className="px-6 py-4 font-semibold">Joined</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold mr-3 uppercase">
                        {user.username.charAt(0)}
                      </div>
                      {user.username}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-800'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    {user.isApproved ? (
                      <span className="flex items-center text-green-600 font-medium">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                        Approved
                      </span>
                    ) : (
                      <span className="flex items-center text-amber-600 font-medium">
                        <span className="w-2 h-2 bg-amber-500 rounded-full mr-2"></span>
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {user.role !== 'admin' && (
                      <Button 
                        onClick={() => handleToggleApproval(user.id)}
                        variant={user.isApproved ? 'outline' : 'primary'}
                        className="!py-1.5 !px-3 !text-xs"
                      >
                        {user.isApproved ? 'Revoke' : 'Approve'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
         <div className="p-6 border-b border-slate-200 bg-slate-50">
            <h2 className="text-lg font-bold text-slate-800">System Activity Log</h2>
         </div>
         <div className="max-h-64 overflow-y-auto p-4 space-y-3">
            {logs.length === 0 ? (
               <p className="text-center text-slate-400 text-sm">No activity recorded yet.</p>
            ) : (
               logs.map(log => (
                 <div key={log.id} className="flex items-start text-sm border-b border-slate-50 pb-2 last:border-0">
                    <span className="text-slate-400 min-w-[140px] text-xs mt-0.5">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                    <div>
                      <span className="font-semibold text-indigo-700 mr-2">{log.username}</span>
                      <span className="text-slate-600">{log.action}</span>
                    </div>
                 </div>
               ))
            )}
         </div>
      </div>
    </div>
  );
};