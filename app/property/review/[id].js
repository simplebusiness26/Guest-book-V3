import React from "react";
import {useLocalSearchParams} from "expo-router";
import ExplorerReviewForm from "../../../components/ExplorerReviewForm";

export default function PropertyReview(){
  const {id,qr}=useLocalSearchParams();
  return <ExplorerReviewForm targetType="property" targetId={id} qrCode={qr}/>;
}
