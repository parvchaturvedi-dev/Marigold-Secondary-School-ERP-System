import React from 'react';
import TimetableHub from '../../components/common/TimetableHub';

const Timetable = ({ session }) => (
  <TimetableHub mode="manage" portalLabel="Clerk" session={session} />
);

export default Timetable;
