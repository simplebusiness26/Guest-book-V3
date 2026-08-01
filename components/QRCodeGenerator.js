import React from "react";
import QRCode from "react-native-qrcode-svg";

export function getListingUrl({
  propertyId,
  businessId,
  activityClubId,
  eventId,
  value
}){
  if(value) return value;

  const base=(process.env.EXPO_PUBLIC_APP_URL || "https://guestbook.app").replace(/\/$/,"");

  if(propertyId) return `${base}/property/${propertyId}`;
  if(businessId) return `${base}/business/${businessId}`;
  if(activityClubId) return `${base}/activity-clubs/${activityClubId}`;
  if(eventId) return `${base}/events/${eventId}`;

  return base;
}

export default function QRCodeGenerator({
  propertyId,
  businessId,
  activityClubId,
  eventId,
  value,
  size=200
}){
  const url=getListingUrl({
    propertyId,
    businessId,
    activityClubId,
    eventId,
    value
  });

  return <QRCode value={url} size={size}/>;
}
