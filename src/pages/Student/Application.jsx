import React from 'react';
import ApplicationUserHub from '../../components/common/ApplicationUserHub';

const Application = ({ session, role }) => {
  return <ApplicationUserHub session={session} role={role} />;
};

export default Application;
