import React from "react";
import {useLocalSearchParams} from "expo-router";
import ExplorerProfileScreen from "../../components/ExplorerProfileScreen";

export default function PublicProfile(){
  const {id}=useLocalSearchParams();
  const profileId=Array.isArray(id) ? id[0] : id;
  return <ExplorerProfileScreen profileId={profileId}/>;
}
