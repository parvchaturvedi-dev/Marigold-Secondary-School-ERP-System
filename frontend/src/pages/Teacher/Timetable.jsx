import React from 'react';
import TimetableHub from '../../components/common/TimetableHub';

const Timetable = ({ session }) => (
  <TimetableHub mode="view" portalLabel="Teacher" session={session} />
);

export default Timetable;
