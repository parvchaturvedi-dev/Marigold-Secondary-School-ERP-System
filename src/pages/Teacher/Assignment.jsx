import React from 'react';
import AssignmentHub from '../../components/common/AssignmentHub';

const Assignment = ({ role, session }) => {
  return <AssignmentHub role={role} session={session} />;
};

export default Assignment;
