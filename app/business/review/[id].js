import React from "react";
import {useLocalSearchParams} from "expo-router";
import ExplorerReviewForm from "../../../components/ExplorerReviewForm";

export default function BusinessReview(){
  const {id,qr}=useLocalSearchParams();
  return <ExplorerReviewForm targetType="business" targetId={id} qrCode={qr}/>;
}
