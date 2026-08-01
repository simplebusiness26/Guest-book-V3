import React from "react";
import { View, Text, StyleSheet } from "react-native";


export default function Saved(){

return(

<View style={styles.container}>

<Text style={styles.title}>
❤️ Saved Places
</Text>

<Text>
Your favourite places will appear here
</Text>

</View>

);

}


const styles = StyleSheet.create({

container:{
flex:1,
justifyContent:"center",
alignItems:"center"
},

title:{
fontSize:28,
fontWeight:"bold"
}

});