type RoleStatusView = 'student' | 'faculty' | 'hod';

export function toRoleGrievanceStatus(status: string, role: RoleStatusView): string {
  if (status !== 'received') {
    return status;
  }

  if (role === 'student') {
    return 'submitted';
  }

  if (role === 'faculty' || role === 'hod') {
    return 'new';
  }

  return status;
}

export function fromRoleGrievanceStatus(status: string, role: RoleStatusView): string {
  if (role === 'hod' && status === 'new') {
    return 'received';
  }

  return status;
}
