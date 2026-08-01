import React from "react";
import { View, Text, StyleSheet } from "react-native";


export default function Scan(){

return(

<View style={styles.container}>

<Text style={styles.title}>
📷 QR Scanner
</Text>

<Text>
Scan your Airbnb Guestbook code
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
fontWeight:"bold",
marginBottom:20
}

});