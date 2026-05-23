import React from 'react';
import ExaminationHub from '../../components/common/ExaminationHub';

const Examinations = ({ role, session, activePage, setActivePage }) => (
  <ExaminationHub
    role={role}
    session={session}
    activePage={activePage}
    setActivePage={setActivePage}
  />
);

export default Examinations;
