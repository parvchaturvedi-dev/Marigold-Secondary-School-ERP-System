import React from 'react';
import EventHub from '../../components/common/EventHub';

const Events = ({ role, session }) => {
  return <EventHub role={role} session={session} />;
};

export default Events;
