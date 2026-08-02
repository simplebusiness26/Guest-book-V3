import React from "react";
import {useLocalSearchParams} from "expo-router";
import ExplorerReviewForm from "../../../components/ExplorerReviewForm";

export default function EventReview(){
  const {id,qr}=useLocalSearchParams();
  return <ExplorerReviewForm targetType="event" targetId={id} qrCode={qr}/>;
}
