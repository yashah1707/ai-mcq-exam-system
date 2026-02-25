import React, { useEffect, useState } from 'react';
import { fetchUsers, updateRole, toggleStatus } from '../services/userService';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AdminUsers(){
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setError(null);
    try{
      const res = await fetchUsers();
      setUsers(res.users || []);
    }catch(err){
      setError(err?.response?.data?.message || err.message);
    }finally{setLoading(false)}
  };

  useEffect(()=>{load()},[]);

  const changeRole = async (id, role) => {
    try{
      await updateRole(id, role);
      await load();
    }catch(err){
      alert(err?.response?.data?.message || err.message);
    }
  };

  const changeStatus = async (id) => {
    try{
      await toggleStatus(id);
      await load();
    }catch(err){
      alert(err?.response?.data?.message || err.message);
    }
  };

  return (
    <div className="container">
      <div className="nav"><h2>Manage Users</h2><div className="small">Admin panel</div></div>
      <div className="card">
        {loading && <LoadingSpinner />}
        {error && <div className="alert alert-danger">{error}</div>}
        {!loading && !users.length && <p className="text-muted text-center">No users found.</p>}
        {!loading && users.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u=> (
                <tr key={u._id}>
                  <td><strong>{u.name}</strong></td>
                  <td className="text-small">{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-primary' : 'badge-info'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {u.isActive ? '✓ Active' : '✗ Inactive'}
                    </span>
                  </td>
                  <td>
                    <button className="button-sm button-secondary" onClick={()=>changeRole(u._id, u.role === 'student' ? 'admin' : 'student')}>
                      {u.role === 'student' ? 'Make Admin' : 'Make Student'}
                    </button>
                    <button 
                      className={`button-sm ${u.isActive ? 'button-danger' : 'button-success'}`} 
                      onClick={()=>changeStatus(u._id)}
                      style={{marginLeft:'4px'}}
                    >
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
