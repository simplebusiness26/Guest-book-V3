import React from "react";
import {Platform,StyleSheet,TextInput,View} from "react-native";

export default function DateTimeField({value,onChange,min}){
  if(Platform.OS==="web"){
    return React.createElement("input",{
      type:"datetime-local",
      value:value || "",
      min:min || undefined,
      onChange:event=>onChange(event.target.value),
      style:{
        width:"100%",
        boxSizing:"border-box",
        backgroundColor:"#242429",
        border:"1px solid #44444c",
        borderRadius:12,
        color:"white",
        fontSize:16,
        padding:"13px 14px",
        colorScheme:"dark",
        outline:"none"
      }
    });
  }

  return(
    <View>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DDTHH:MM"
        placeholderTextColor="#74747d"
        autoCapitalize="none"
        style={styles.input}
      />
    </View>
  );
}

const styles=StyleSheet.create({
  input:{
    backgroundColor:"#242429",
    borderColor:"#44444c",
    borderWidth:1,
    borderRadius:12,
    color:"white",
    fontSize:16,
    paddingHorizontal:14,
    paddingVertical:13
  }
});
