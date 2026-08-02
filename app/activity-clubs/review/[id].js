import React from "react";
import {useLocalSearchParams} from "expo-router";
import ExplorerReviewForm from "../../../components/ExplorerReviewForm";

export default function ActivityClubReview(){
  const {id,qr}=useLocalSearchParams();
  return <ExplorerReviewForm targetType="activity_club" targetId={id} qrCode={qr}/>;
}
