import React,{useCallback,useState} from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator
} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../../services/supabase";

function formatEventDate(value){
  if(!value) return "Date to be confirmed";

  return new Date(value).toLocaleString([],{
    weekday:"short",
    day:"numeric",
    month:"short",
    hour:"2-digit",
    minute:"2-digit"
  });
}

function formatPrice(value){
  const amount=Number(value || 0);
  return amount>0 ? `£${amount.toFixed(2)}` : "Free";
}

export default function EventsIndex(){
  const [events,setEvents]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useFocusEffect(useCallback(()=>{
    loadEvents();
  },[]));

  async function loadEvents(){
    setLoading(true);
    setError("");

    const {data,error:eventsError}=await supabase
      .from("events")
      .select("id,name,category,description,location,address,starts_at,ends_at,price,capacity,status")
      .eq("status","published")
      .order("starts_at",{ascending:true});

    if(eventsError){
      console.log(eventsError);
      setEvents([]);
      setError("Events could not be loaded right now.");
      setLoading(false);
      return;
    }

    setEvents(data || []);
    setLoading(false);
  }

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Explore Events</Text>
      <Text style={styles.subtitle}>
        Discover upcoming local events, community days and experiences.
      </Text>

      {loading && (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="white"/>
          <Text style={styles.stateText}>Loading events...</Text>
        </View>
      )}

      {!loading && !!error && (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Unable to load events</Text>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadEvents}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && events.length===0 && (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>No published events yet</Text>
          <Text style={styles.stateText}>
            New local events will appear here as managers publish them.
          </Text>
        </View>
      )}

      {!loading && !error && events.map(event=>(
        <Pressable
          key={event.id}
          style={styles.eventCard}
          onPress={()=>router.push(`/events/${event.id}`)}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.category}>{event.category || "Event"}</Text>
            <Text style={styles.price}>{formatPrice(event.price)}</Text>
          </View>

          <Text style={styles.eventName}>{event.name}</Text>
          <Text style={styles.date}>🗓 {formatEventDate(event.starts_at)}</Text>
          <Text style={styles.location}>📍 {event.location || event.address || "Location to be confirmed"}</Text>

          {!!event.description && (
            <Text style={styles.description} numberOfLines={3}>
              {event.description}
            </Text>
          )}

          <View style={styles.viewButton}>
            <Text style={styles.buttonText}>View Event</Text>
          </View>
        </Pressable>
      ))}
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
  title:{
    color:"white",
    fontSize:38,
    fontWeight:"bold"
  },
  subtitle:{
    color:"#b8b8bd",
    fontSize:17,
    lineHeight:25,
    marginTop:10,
    marginBottom:26
  },
  centerState:{
    alignItems:"center",
    paddingVertical:50
  },
  stateCard:{
    backgroundColor:"#242426",
    borderWidth:1,
    borderColor:"#4b4b4f",
    borderRadius:16,
    padding:20
  },
  stateTitle:{
    color:"white",
    fontSize:21,
    fontWeight:"bold"
  },
  stateText:{
    color:"#b8b8bd",
    fontSize:16,
    lineHeight:23,
    marginTop:8,
    textAlign:"center"
  },
  retryButton:{
    backgroundColor:"#0929d4",
    padding:15,
    borderRadius:12,
    marginTop:18
  },
  eventCard:{
    backgroundColor:"#232326",
    borderWidth:1,
    borderColor:"#505055",
    borderRadius:18,
    padding:20,
    marginBottom:18
  },
  cardHeader:{
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between",
    gap:12
  },
  category:{
    color:"#d8b4ff",
    fontWeight:"bold",
    fontSize:15
  },
  price:{
    color:"#8be29d",
    fontWeight:"bold",
    fontSize:15
  },
  eventName:{
    color:"white",
    fontSize:27,
    lineHeight:34,
    fontWeight:"bold",
    marginTop:12
  },
  date:{
    color:"white",
    fontSize:16,
    marginTop:14
  },
  location:{
    color:"#c2c2c7",
    fontSize:16,
    lineHeight:23,
    marginTop:8
  },
  description:{
    color:"#c2c2c7",
    fontSize:16,
    lineHeight:23,
    marginTop:14
  },
  viewButton:{
    backgroundColor:"#25009f",
    borderRadius:12,
    padding:15,
    marginTop:18
  },
  buttonText:{
    color:"white",
    textAlign:"center",
    fontWeight:"bold",
    fontSize:16
  }
});