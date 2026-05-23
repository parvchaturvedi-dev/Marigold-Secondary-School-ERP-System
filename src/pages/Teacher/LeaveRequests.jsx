import React from 'react';
import LeaveRequestUserHub from '../../components/common/LeaveRequestUserHub';

const LeaveRequests = ({ session, role }) => (
  <LeaveRequestUserHub session={session} role={role} />
);

export default LeaveRequests;
