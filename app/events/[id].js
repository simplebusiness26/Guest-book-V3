import React,{useCallback,useState} from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Linking
} from "react-native";
import {useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";

function formatEventDate(value){
  if(!value) return "Date to be confirmed";

  return new Date(value).toLocaleString([],{
    weekday:"long",
    day:"numeric",
    month:"long",
    year:"numeric",
    hour:"2-digit",
    minute:"2-digit"
  });
}

function formatPrice(value){
  const amount=Number(value || 0);
  return amount>0 ? `£${amount.toFixed(2)}` : "Free to attend";
}

function safeWebUrl(value){
  const text=(value || "").trim();
  if(!text) return "";
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

export default function EventDetails(){
  const {id}=useLocalSearchParams();
  const [event,setEvent]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useFocusEffect(useCallback(()=>{
    if(id) loadEvent();
  },[id]));

  async function loadEvent(){
    setLoading(true);
    setError("");

    const {data,error:eventError}=await supabase
      .from("events")
      .select("*")
      .eq("id",id)
      .eq("status","published")
      .single();

    if(eventError){
      console.log(eventError);
      setEvent(null);
      setError("This event could not be loaded.");
      setLoading(false);
      return;
    }

    setEvent(data);
    setLoading(false);
  }

  async function openBooking(){
    const url=safeWebUrl(event?.booking_url);
    if(!url) return;

    const supported=await Linking.canOpenURL(url);
    if(supported) await Linking.openURL(url);
  }

  if(loading){
    return(
      <View style={styles.center}>
        <ActivityIndicator size="large" color="white"/>
        <Text style={styles.loadingText}>Loading event...</Text>
      </View>
    );
  }

  if(error || !event){
    return(
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Event unavailable</Text>
        <Text style={styles.errorText}>{error || "Event not found."}</Text>
      </View>
    );
  }

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.topRow}>
          <Text style={styles.category}>{event.category || "Event"}</Text>
          <Text style={styles.price}>{formatPrice(event.price)}</Text>
        </View>

        <Text style={styles.title}>{event.name}</Text>
        <Text style={styles.date}>🗓 {formatEventDate(event.starts_at)}</Text>

        {!!event.ends_at && (
          <Text style={styles.meta}>Ends {formatEventDate(event.ends_at)}</Text>
        )}

        <Text style={styles.location}>📍 {event.location || "Location to be confirmed"}</Text>
        {!!event.address && <Text style={styles.address}>{event.address}</Text>}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>About this event</Text>
        <Text style={styles.description}>
          {event.description || "More information will be added by the event manager."}
        </Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Event details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Price</Text>
          <Text style={styles.detailValue}>{formatPrice(event.price)}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Capacity</Text>
          <Text style={styles.detailValue}>
            {event.capacity ? `${event.capacity} people` : "Not specified"}
          </Text>
        </View>
      </View>

      {!!event.booking_url && (
        <Pressable style={styles.bookingButton} onPress={openBooking}>
          <Text style={styles.buttonText}>Book or Learn More</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{
    flex:1,
    backgroundColor:"#1b1b1d"
  },
  content:{
    padding:24,
    paddingBottom:60
  },
  center:{
    flex:1,
    backgroundColor:"#1b1b1d",
    alignItems:"center",
    justifyContent:"center",
    padding:28
  },
  loadingText:{
    color:"#b8b8bd",
    marginTop:14
  },
  errorTitle:{
    color:"white",
    fontSize:28,
    fontWeight:"bold"
  },
  errorText:{
    color:"#b8b8bd",
    fontSize:16,
    lineHeight:23,
    textAlign:"center",
    marginTop:10
  },
  hero:{
    backgroundColor:"#232326",
    borderWidth:1,
    borderColor:"#505055",
    borderRadius:18,
    padding:22
  },
  topRow:{
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between",
    gap:12
  },
  category:{
    color:"#d8b4ff",
    fontWeight:"bold",
    fontSize:16
  },
  price:{
    color:"#8be29d",
    fontWeight:"bold",
    fontSize:16
  },
  title:{
    color:"white",
    fontSize:36,
    lineHeight:43,
    fontWeight:"bold",
    marginTop:14
  },
  date:{
    color:"white",
    fontSize:17,
    lineHeight:24,
    marginTop:18
  },
  meta:{
    color:"#b8b8bd",
    fontSize:15,
    lineHeight:22,
    marginTop:6
  },
  location:{
    color:"white",
    fontSize:17,
    lineHeight:24,
    marginTop:18
  },
  address:{
    color:"#b8b8bd",
    fontSize:16,
    lineHeight:23,
    marginTop:6
  },
  sectionCard:{
    backgroundColor:"#232326",
    borderWidth:1,
    borderColor:"#505055",
    borderRadius:18,
    padding:20,
    marginTop:18
  },
  sectionTitle:{
    color:"white",
    fontSize:23,
    fontWeight:"bold"
  },
  description:{
    color:"#c2c2c7",
    fontSize:17,
    lineHeight:26,
    marginTop:12
  },
  detailRow:{
    flexDirection:"row",
    alignItems:"flex-start",
    justifyContent:"space-between",
    gap:20,
    marginTop:14
  },
  detailLabel:{
    color:"#b8b8bd",
    fontSize:16
  },
  detailValue:{
    color:"white",
    fontSize:16,
    fontWeight:"bold",
    textAlign:"right",
    flexShrink:1
  },
  bookingButton:{
    backgroundColor:"#25009f",
    borderRadius:14,
    padding:18,
    marginTop:20
  },
  buttonText:{
    color:"white",
    textAlign:"center",
    fontWeight:"bold",
    fontSize:18
  }
});