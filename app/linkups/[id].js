import React,{useCallback,useState} from "react";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,View} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";
import {effectiveLinkupStatus,formatDateTime,statusLabel} from "../../utils/linkups";

const REPORTS=["spam","harassment","unsafe","inappropriate","false_information","other"];

export default function LinkupDetail(){
  const params=useLocalSearchParams();
  const id=Array.isArray(params.id)?params.id[0]:params.id;
  const {showFeedback}=useFeedback();
  const [user,setUser]=useState(null);
  const [linkup,setLinkup]=useState(null);
  const [creator,setCreator]=useState(null);
  const [attendees,setAttendees]=useState([]);
  const [privateDetails,setPrivateDetails]=useState("");
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");
  const [showReport,setShowReport]=useState(false);
  const [reportReason,setReportReason]=useState("unsafe");
  const [confirmCancel,setConfirmCancel]=useState(false);

  const load=useCallback(async()=>{
    if(!id){setError("Link-up not found.");setLoading(false);return;}
    setLoading(true);setError("");
    const {data:{user:currentUser}}=await supabase.auth.getUser();
    if(!currentUser){router.replace("/auth/login");return;}
    setUser(currentUser);
    await supabase.rpc("refresh_live_system");

    const {data:row,error:linkupError}=await supabase.from("linkups").select("*").eq("id",id).maybeSingle();
    if(linkupError || !row){setError("This Link-up is unavailable or no longer visible to you.");setLinkup(null);setLoading(false);return;}
    setLinkup(row);

    const [{data:creatorRow},{data:attendeeRows},{data:privateRow}]=await Promise.all([
      supabase.from("profiles").select("id,full_name,profile_photo,area,show_area").eq("id",row.creator_id).maybeSingle(),
      supabase.from("linkup_attendees").select("user_id,role,status,joined_at").eq("linkup_id",id).eq("status","joined").order("joined_at"),
      supabase.from("linkup_private_details").select("meeting_point_details").eq("linkup_id",id).maybeSingle()
    ]);
    setCreator(creatorRow || null);
    const attendeeIds=(attendeeRows || []).map(item=>item.user_id);
    let profiles={};
    if(attendeeIds.length){
      const {data}=await supabase.from("profiles").select("id,full_name,profile_photo").in("id",attendeeIds);
      profiles=Object.fromEntries((data || []).map(item=>[item.id,item]));
    }
    setAttendees((attendeeRows || []).map(item=>({...item,profile:profiles[item.user_id] || null})));
    setPrivateDetails(privateRow?.meeting_point_details || "");
    setLoading(false);
  },[id]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  async function callRpc(name,args,success){
    if(working) return;
    setWorking(true);
    const {error:rpcError}=await supabase.rpc(name,args);
    setWorking(false);
    if(rpcError){showFeedback(rpcError.message,"error","Action not completed");return;}
    if(success) showFeedback(success,"success","Link-up updated");
    await load();
  }

  async function report(){
    if(!linkup || working) return;
    setWorking(true);
    const {error:reportError}=await supabase.rpc("report_live_safety",{p_target_type:"linkup",p_target_id:linkup.id,p_reason:reportReason,p_details:""});
    setWorking(false);setShowReport(false);
    if(reportError) showFeedback(reportError.message,"error","Report not sent");
    else showFeedback("The Link-up has been sent for review.","success","Report submitted");
  }

  async function blockCreator(){
    if(!creator || working) return;
    setWorking(true);
    const {error:blockError}=await supabase.rpc("block_explorer",{p_user_id:creator.id});
    setWorking(false);
    if(blockError){showFeedback(blockError.message,"error","Explorer not blocked");return;}
    showFeedback("You will no longer see each other's social or live activity.","success","Explorer blocked");
    router.replace("/linkups");
  }

  if(loading) return <View style={styles.center}><ActivityIndicator size="large" color="#bca8ff"/></View>;
  if(error || !linkup) return <View style={styles.center}><Text style={styles.errorTitle}>Link-up unavailable</Text><Text style={styles.errorText}>{error}</Text><Pressable style={styles.backButton} onPress={()=>router.replace("/linkups")}><Text style={styles.backText}>Back to Link-ups</Text></Pressable></View>;

  const status=effectiveLinkupStatus(linkup);
  const isOwner=user?.id===linkup.creator_id;
  const joined=attendees.some(item=>item.user_id===user?.id);
  const canJoin=!isOwner&&!joined&&status==="upcoming";
  const boardOpen=joined;

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.topRow}><Text style={styles.category}>{linkup.category}</Text><Text style={styles.status}>{statusLabel(status)}</Text></View>
        <Text style={styles.title}>{linkup.title}</Text>
        <Text style={styles.when}>{formatDateTime(linkup.starts_at)} – {formatDateTime(linkup.ends_at)}</Text>
        <Text style={styles.place}>📍 {linkup.location_name}, {linkup.area}</Text>
        <Text style={styles.description}>{linkup.description}</Text>
        <View style={styles.capacityRow}><Text style={styles.capacity}>{linkup.attendee_count}/{linkup.max_attendees} joined</Text><Text style={styles.visibility}>{linkup.visibility==="followers"?"Followers only":"Public"}</Text></View>
      </View>

      <Pressable style={styles.creatorCard} onPress={()=>router.push(`/profile/${linkup.creator_id}`)}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{creator?.full_name?.charAt(0)?.toUpperCase() || "E"}</Text></View>
        <View style={styles.creatorText}><Text style={styles.creatorLabel}>ORGANISED BY</Text><Text style={styles.creatorName}>{creator?.full_name || "Explorer"}</Text>{creator?.show_area&&creator?.area?<Text style={styles.creatorArea}>{creator.area}</Text>:null}</View>
        <Text style={styles.arrow}>›</Text>
      </Pressable>

      {joined && privateDetails!=="" && <View style={styles.privateCard}><Text style={styles.privateLabel}>ATTENDEE MEETING DETAILS</Text><Text style={styles.privateText}>{privateDetails}</Text></View>}

      <View style={styles.actions}>
        {canJoin && <Pressable style={styles.primaryButton} disabled={working} onPress={()=>callRpc("join_linkup",{p_linkup_id:id},"You joined the Link-up.")}><Text style={styles.primaryText}>Join Link-up</Text></Pressable>}
        {!isOwner&&joined&&status!=="completed"&&<Pressable style={styles.secondaryButton} disabled={working} onPress={()=>callRpc("leave_linkup",{p_linkup_id:id},"You left the Link-up.")}><Text style={styles.secondaryText}>Leave Link-up</Text></Pressable>}
        {boardOpen&&<Pressable style={styles.boardButton} onPress={()=>router.push(`/linkups/board/${id}`)}><Text style={styles.boardText}>💬 Open private board</Text></Pressable>}
        {isOwner&&!["cancelled","completed"].includes(status)&&<Pressable style={styles.secondaryButton} onPress={()=>router.push(`/linkups/edit/${id}`)}><Text style={styles.secondaryText}>Edit Link-up</Text></Pressable>}
        {isOwner&&!["cancelled","completed"].includes(status)&&<Pressable style={styles.cancelButton} onPress={()=>setConfirmCancel(true)}><Text style={styles.cancelText}>Cancel Link-up</Text></Pressable>}
      </View>

      {confirmCancel&&isOwner&&<View style={styles.warningCard}><Text style={styles.warningTitle}>Cancel this Link-up?</Text><Text style={styles.warningText}>Everyone who joined will be notified. The board becomes read-only.</Text><View style={styles.warningActions}><Pressable onPress={()=>setConfirmCancel(false)}><Text style={styles.keepText}>Keep it</Text></Pressable><Pressable style={styles.confirmCancel} disabled={working} onPress={()=>{setConfirmCancel(false);callRpc("cancel_linkup",{p_linkup_id:id},"The Link-up was cancelled.");}}><Text style={styles.confirmText}>Cancel it</Text></Pressable></View></View>}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Attendees</Text>
        {attendees.map(item=><View key={item.user_id} style={styles.attendeeRow}><Pressable style={styles.attendeeProfile} onPress={()=>router.push(`/profile/${item.user_id}`)}><View style={styles.smallAvatar}><Text style={styles.smallAvatarText}>{item.profile?.full_name?.charAt(0)?.toUpperCase() || "E"}</Text></View><View><Text style={styles.attendeeName}>{item.profile?.full_name || "Explorer"}</Text><Text style={styles.attendeeRole}>{item.role==="creator"?"Organiser":"Attendee"}</Text></View></Pressable>{isOwner&&item.user_id!==user.id&&<Pressable disabled={working} onPress={()=>callRpc("remove_linkup_attendee",{p_linkup_id:id,p_user_id:item.user_id},"Attendee removed.")}><Text style={styles.removeText}>Remove</Text></Pressable>}</View>)}
      </View>

      {!isOwner&&<View style={styles.safetySection}><Pressable onPress={()=>setShowReport(current=>!current)}><Text style={styles.safetyLink}>Report Link-up</Text></Pressable><Pressable onPress={blockCreator}><Text style={styles.blockLink}>Block organiser</Text></Pressable></View>}
      {showReport&&!isOwner&&<View style={styles.reportCard}><Text style={styles.reportTitle}>Why are you reporting this?</Text><View style={styles.reasonWrap}>{REPORTS.map(reason=><Pressable key={reason} style={[styles.reason,reportReason===reason&&styles.reasonActive]} onPress={()=>setReportReason(reason)}><Text style={[styles.reasonText,reportReason===reason&&styles.reasonTextActive]}>{reason.replace("_"," ")}</Text></Pressable>)}</View><Pressable style={styles.reportButton} disabled={working} onPress={report}><Text style={styles.reportButtonText}>Submit report</Text></Pressable></View>}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#18181b"},content:{padding:18,paddingBottom:70},center:{flex:1,backgroundColor:"#18181b",alignItems:"center",justifyContent:"center",padding:28},errorTitle:{color:"white",fontSize:22,fontWeight:"900"},errorText:{color:"#aaaab3",textAlign:"center",marginTop:8},backButton:{backgroundColor:"#3212b6",borderRadius:12,paddingHorizontal:18,paddingVertical:12,marginTop:18},backText:{color:"white",fontWeight:"900"},
  hero:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:18,padding:17},topRow:{flexDirection:"row",justifyContent:"space-between"},category:{color:"#cbbdff",fontWeight:"900",fontSize:11,textTransform:"uppercase"},status:{color:"#9fe6c7",fontWeight:"900",fontSize:11},title:{color:"white",fontSize:30,fontWeight:"900",marginTop:10},when:{color:"#c7b8f5",fontWeight:"800",marginTop:10},place:{color:"#d0d0d6",marginTop:8},description:{color:"#aaaab3",lineHeight:22,marginTop:13},capacityRow:{flexDirection:"row",justifyContent:"space-between",marginTop:16},capacity:{color:"white",fontWeight:"900"},visibility:{color:"#9696a0",fontSize:11,fontWeight:"800"},
  creatorCard:{flexDirection:"row",alignItems:"center",backgroundColor:"#29233b",borderColor:"#504373",borderWidth:1,borderRadius:14,padding:12,marginTop:13},avatar:{width:50,height:50,borderRadius:25,backgroundColor:"#3212b6",alignItems:"center",justifyContent:"center"},avatarText:{color:"white",fontSize:20,fontWeight:"900"},creatorText:{flex:1,marginLeft:11},creatorLabel:{color:"#9f90ca",fontSize:9,fontWeight:"900"},creatorName:{color:"white",fontWeight:"900",marginTop:3},creatorArea:{color:"#9790a8",fontSize:11,marginTop:2},arrow:{color:"#bca8ff",fontSize:28},
  privateCard:{backgroundColor:"#173d31",borderColor:"#2b6b54",borderWidth:1,borderRadius:14,padding:14,marginTop:13},privateLabel:{color:"#91d9bb",fontSize:9,fontWeight:"900",letterSpacing:.6},privateText:{color:"#dcf5ea",lineHeight:20,marginTop:6},actions:{gap:9,marginTop:15},primaryButton:{backgroundColor:"#3212b6",borderRadius:13,padding:15,alignItems:"center"},primaryText:{color:"white",fontWeight:"900"},secondaryButton:{backgroundColor:"#29292e",borderColor:"#494950",borderWidth:1,borderRadius:13,padding:14,alignItems:"center"},secondaryText:{color:"white",fontWeight:"900"},boardButton:{backgroundColor:"#173e58",borderColor:"#2e6687",borderWidth:1,borderRadius:13,padding:14,alignItems:"center"},boardText:{color:"#d4efff",fontWeight:"900"},cancelButton:{padding:13,alignItems:"center"},cancelText:{color:"#ff8e9c",fontWeight:"900"},
  warningCard:{backgroundColor:"#421f25",borderColor:"#803842",borderWidth:1,borderRadius:14,padding:14,marginTop:12},warningTitle:{color:"white",fontWeight:"900",fontSize:16},warningText:{color:"#d7b9bd",lineHeight:18,marginTop:5},warningActions:{flexDirection:"row",alignItems:"center",justifyContent:"flex-end",gap:16,marginTop:13},keepText:{color:"#c5b5b9",fontWeight:"900"},confirmCancel:{backgroundColor:"#b11d28",borderRadius:10,paddingHorizontal:14,paddingVertical:10},confirmText:{color:"white",fontWeight:"900"},
  section:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:16,padding:14,marginTop:16},sectionTitle:{color:"white",fontSize:18,fontWeight:"900",marginBottom:5},attendeeRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingVertical:9,borderBottomColor:"#34343a",borderBottomWidth:1},attendeeProfile:{flexDirection:"row",alignItems:"center",flex:1},smallAvatar:{width:38,height:38,borderRadius:19,backgroundColor:"#302655",alignItems:"center",justifyContent:"center"},smallAvatarText:{color:"white",fontWeight:"900"},attendeeName:{color:"white",fontWeight:"800",marginLeft:9},attendeeRole:{color:"#85858f",fontSize:10,marginLeft:9,marginTop:2},removeText:{color:"#ff8e9c",fontWeight:"900",fontSize:11,padding:8},
  safetySection:{flexDirection:"row",justifyContent:"space-between",paddingVertical:18},safetyLink:{color:"#c8a34b",fontWeight:"900",fontSize:12},blockLink:{color:"#ff8697",fontWeight:"900",fontSize:12},reportCard:{backgroundColor:"#29292e",borderColor:"#47474f",borderWidth:1,borderRadius:14,padding:13},reportTitle:{color:"white",fontWeight:"900"},reasonWrap:{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:10},reason:{borderColor:"#505058",borderWidth:1,borderRadius:18,paddingHorizontal:10,paddingVertical:7},reasonActive:{backgroundColor:"#3212b6",borderColor:"#654ce2"},reasonText:{color:"#aaaab3",fontSize:10,fontWeight:"800",textTransform:"capitalize"},reasonTextActive:{color:"white"},reportButton:{backgroundColor:"#8e171f",borderRadius:10,padding:12,alignItems:"center",marginTop:12},reportButtonText:{color:"white",fontWeight:"900"}
});
