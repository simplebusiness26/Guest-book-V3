import React,{useCallback,useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert
} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../../services/supabase";

export default function ManageActivityClub(){
  const {id}=useLocalSearchParams();
  const [club,setClub]=useState(null);
  const [pending,setPending]=useState([]);
  const [approved,setApproved]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useFocusEffect(
    useCallback(()=>{
      if(id) loadManagerPage();
    },[id])
  );

  async function loadManagerPage(){
    setLoading(true);
    setError("");

    const {data:{user}}=await supabase.auth.getUser();
    if(!user){
      router.replace("/auth/login");
      return;
    }

    const {data:clubRow,error:clubError}=await supabase
      .from("activity_clubs")
      .select("*")
      .eq("id",id)
      .eq("manager_id",user.id)
      .single();

    if(clubError){
      console.log(clubError);
      setError("You do not have permission to manage this club.");
      setLoading(false);
      return;
    }

    setClub(clubRow);

    const {data:memberships,error:memberError}=await supabase
      .from("activity_memberships")
      .select("*")
      .eq("club_id",id)
      .order("applied_at",{ascending:true});

    if(memberError){
      console.log(memberError);
      setError("Membership applications could not be loaded.");
      setLoading(false);
      return;
    }

    setPending((memberships || []).filter(item=>item.status==="pending"));
    setApproved((memberships || []).filter(item=>item.status==="approved"));
    setLoading(false);
  }

  async function decideApplication(membershipId,nextStatus){
    const updates={
      status:nextStatus,
      decided_at:new Date().toISOString()
    };

    const {error:updateError}=await supabase
      .from("activity_memberships")
      .update(updates)
      .eq("id",membershipId)
      .eq("club_id",id);

    if(updateError){
      console.log(updateError);
      Alert.alert("Could not update application",updateError.message);
      return;
    }

    await loadManagerPage();
  }

  if(loading){
    return(
      <View style={styles.center}>
        <ActivityIndicator size="large"/>
      </View>
    );
  }

  if(error || !club){
    return(
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || "Club not found"}</Text>
      </View>
    );
  }

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{club.name}</Text>
      <Text style={styles.subtitle}>Manager controls</Text>

      <Pressable
        style={styles.boardButton}
        onPress={()=>router.push(`/activity-clubs/message-board/${club.id}`)}
      >
        <Text style={styles.buttonText}>Open Club Message Board</Text>
      </Pressable>

      <Pressable
        style={styles.publicButton}
        onPress={()=>router.push(`/activity-clubs/${club.id}`)}
      >
        <Text style={styles.publicButtonText}>View Public Club Profile</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Pending applications ({pending.length})</Text>
      {pending.length===0 && (
        <View style={styles.emptyBox}>
          <Text>No pending applications.</Text>
        </View>
      )}

      {pending.map(item=>(
        <View key={item.id} style={styles.card}>
          <Text style={styles.memberName}>{item.applicant_name || "Explorer"}</Text>
          {!!item.application_note && <Text style={styles.note}>{item.application_note}</Text>}
          <View style={styles.actionRow}>
            <Pressable
              style={styles.approveButton}
              onPress={()=>decideApplication(item.id,"approved")}
            >
              <Text style={styles.buttonText}>Approve</Text>
            </Pressable>
            <Pressable
              style={styles.rejectButton}
              onPress={()=>decideApplication(item.id,"rejected")}
            >
              <Text style={styles.buttonText}>Reject</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Approved members ({approved.length})</Text>
      {approved.length===0 && (
        <View style={styles.emptyBox}>
          <Text>No approved members yet.</Text>
        </View>
      )}

      {approved.map(item=>(
        <View key={item.id} style={styles.card}>
          <Text style={styles.memberName}>{item.applicant_name || "Explorer"}</Text>
          <Text style={styles.approvedText}>Message board access enabled</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:"#f5f6f8"},
  content:{padding:20,paddingBottom:50},
  center:{flex:1,alignItems:"center",justifyContent:"center",padding:30},
  errorText:{fontSize:18,textAlign:"center"},
  title:{fontSize:30,fontWeight:"bold"},
  subtitle:{color:"#666",marginTop:6,marginBottom:16},
  boardButton:{backgroundColor:"#5633a8",padding:16,borderRadius:12},
  publicButton:{backgroundColor:"white",padding:15,borderRadius:12,borderWidth:1,borderColor:"#ccc",marginTop:10},
  publicButtonText:{fontWeight:"bold",textAlign:"center"},
  buttonText:{color:"white",fontWeight:"bold",textAlign:"center"},
  sectionTitle:{fontSize:22,fontWeight:"bold",marginTop:28,marginBottom:12},
  emptyBox:{backgroundColor:"white",padding:16,borderRadius:12,borderWidth:1,borderColor:"#ddd"},
  card:{backgroundColor:"white",padding:16,borderRadius:12,borderWidth:1,borderColor:"#ddd",marginBottom:12},
  memberName:{fontSize:18,fontWeight:"bold"},
  note:{marginTop:7,color:"#444",lineHeight:20},
  actionRow:{flexDirection:"row",gap:10,marginTop:14},
  approveButton:{flex:1,backgroundColor:"#218739",padding:13,borderRadius:10},
  rejectButton:{flex:1,backgroundColor:"#c23b3b",padding:13,borderRadius:10},
  approvedText:{color:"#218739",fontWeight:"600",marginTop:7}
});
