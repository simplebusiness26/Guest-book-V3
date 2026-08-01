import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

export default function Place() {

  return (

    <View style={styles.container}>

      <Text style={styles.title}>
        ☕ The Coffee House
      </Text>

      <Text style={styles.rating}>
        ⭐⭐⭐⭐⭐ 4.8
      </Text>

      <Text style={styles.description}>
        Independent coffee shop serving locally roasted coffee,
        homemade cakes and breakfast.
      </Text>

      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>
          Leave Review
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>
          Get Directions
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>
          Visit Website
        </Text>
      </TouchableOpacity>

    </View>

  );

}

const styles = StyleSheet.create({

container:{
flex:1,
padding:25
},

title:{
fontSize:30,
fontWeight:"bold",
marginBottom:10
},

rating:{
fontSize:22,
marginBottom:20
},

description:{
fontSize:18,
marginBottom:30
},

button:{
backgroundColor:"#2E86DE",
padding:18,
borderRadius:10,
marginBottom:15
},

buttonText:{
color:"#fff",
fontSize:18,
textAlign:"center",
fontWeight:"bold"
}

});