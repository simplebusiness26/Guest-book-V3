import React from "react";
import {StyleSheet,View} from "react-native";
import ExplorerProfileScreen from "../components/ExplorerProfileScreen";
import ProfileSocialBar from "../components/ProfileSocialBar";

export default function Profile(){
  return(
    <View style={styles.screen}>
      <ProfileSocialBar ownProfile/>
      <ExplorerProfileScreen ownProfile/>
    </View>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#18181b"}
});
