import React, { useEffect, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  Linking,
  ActivityIndicator,
  Modal,
} from "react-native";

import { useLocalSearchParams, router } from "expo-router";

import { supabase } from "../../services/supabase";

import QRCodeGenerator from "../../components/QRCodeGenerator";

import ClaimButton from "../../components/ClaimButton";


function formatReviewDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}


function getInitial(name) {
  if (!name) return "?";

  return name
    .trim()
    .charAt(0)
    .toUpperCase();
}


function getReviewPhotos(review) {
  if (!Array.isArray(review?.photos)) {
    return [];
  }

  return review.photos
    .filter(
      (photo) =>
        typeof photo === "string" &&
        photo.trim().length > 0
    )
    .slice(0, 3);
}


export default function PropertyDetails() {
  const params = useLocalSearchParams();

  const propertyId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [property, setProperty] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [averageRating, setAverageRating] = useState(0);

  const [canClaim, setCanClaim] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  const [loading, setLoading] = useState(true);
  const [selectedReviewPhoto, setSelectedReviewPhoto] =
    useState(null);


  useEffect(() => {
    loadAll();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);


  async function loadAll() {
    if (!propertyId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    await Promise.all([
      loadProperty(),
      loadReviews(),
      checkUser(),
    ]);

    setLoading(false);
  }


  async function checkUser() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setCanClaim(false);
      setIsOwner(false);
      return;
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
      console.log(
        "Property profile error:",
        profileError
      );

      setCanClaim(false);
    } else {
      setCanClaim(
        profile?.account_type === "manager"
      );
    }

    const { data: owned, error: ownerError } =
      await supabase
        .from("properties")
        .select("id")
        .eq("id", propertyId)
        .eq("owner_id", user.id)
        .maybeSingle();

    if (ownerError) {
      console.log(
        "Property owner check error:",
        ownerError
      );

      setIsOwner(false);
      return;
    }

    setIsOwner(Boolean(owned));
  }


  async function loadProperty() {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("id", propertyId)
      .single();

    if (error) {
      console.log(
        "Property loading error:",
        error
      );

      setProperty(null);
      return;
    }

    setProperty(data);
  }


  async function loadReviews() {
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.log(
        "Property review loading error:",
        error
      );

      setReviews([]);
      setAverageRating(0);
      return;
    }

    const list = data || [];

    setReviews(list);

    if (list.length > 0) {
      const total = list.reduce(
        (sum, review) =>
          sum + Number(review.rating || 0),
        0
      );

      setAverageRating(
        (total / list.length).toFixed(1)
      );
    } else {
      setAverageRating(0);
    }
  }


  async function openBookingPage() {
    if (!property?.booking_url) {
      return;
    }

    let url = property.booking_url.trim();

    if (
      !url.startsWith("http://") &&
      !url.startsWith("https://")
    ) {
      url = `https://${url}`;
    }

    try {
      const supported =
        await Linking.canOpenURL(url);

      if (!supported) {
        console.log(
          "Unsupported booking URL:",
          url
        );
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.log(
        "Booking URL error:",
        error
      );
    }
  }


  function openProfile(userId) {
    if (!userId) {
      return;
    }

    router.push(`/profile/${userId}`);
  }


  function openReviewPhoto(event, photo) {
    if (event?.stopPropagation) {
      event.stopPropagation();
    }

    setSelectedReviewPhoto(photo);
  }


  function closeReviewPhoto() {
    setSelectedReviewPhoto(null);
  }


  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Loading property...
        </Text>
      </View>
    );
  }


  if (!property) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>
          Property not found
        </Text>
      </View>
    );
  }


  const propertyPhotos = [
    property.image,
    ...(Array.isArray(property.photos)
      ? property.photos
      : []),
  ].filter(Boolean);

  const uniquePhotos = [
    ...new Set(propertyPhotos),
  ];


  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {uniquePhotos.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Photos
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={
                styles.photoRow
              }
            >
              {uniquePhotos.map(
                (photo, index) => (
                  <Image
                    key={`${photo}-${index}`}
                    source={{ uri: photo }}
                    style={styles.photo}
                    resizeMode="cover"
                  />
                )
              )}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.photoFallback}>
            <Text
              style={styles.photoFallbackText}
            >
              No property photos uploaded yet
            </Text>
          </View>
        )}


        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.title}>
                {property.name}
              </Text>

              {Boolean(property.host) ? (
                <Text style={styles.host}>
                  Hosted by {property.host}
                </Text>
              ) : null}

              {Boolean(property.owner_id) ? (
                <View style={styles.verifiedPill}>
                  <Text
                    style={styles.verifiedText}
                  >
                    ✓ Verified Property
                  </Text>
                </View>
              ) : null}
            </View>

            {Boolean(isOwner) ? (
              <Pressable
                style={styles.editButtonSmall}
                onPress={() =>
                  router.push(
                    `/property/edit/${propertyId}`
                  )
                }
              >
                <Text style={styles.buttonText}>
                  Edit
                </Text>
              </Pressable>
            ) : null}
          </View>


          {Boolean(property.description) ? (
            <Text style={styles.description}>
              {property.description}
            </Text>
          ) : null}


          {Boolean(property.address) ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>
                Address
              </Text>

              <Text style={styles.infoText}>
                📍 {property.address}
              </Text>
            </View>
          ) : null}


          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                ⭐{" "}
                {reviews.length > 0
                  ? averageRating
                  : "—"}
              </Text>

              <Text style={styles.statLabel}>
                Average rating
              </Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {reviews.length}
              </Text>

              <Text style={styles.statLabel}>
                Reviews
              </Text>
            </View>
          </View>
        </View>


        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Actions
          </Text>

          {Boolean(property.booking_url) ? (
            <Pressable
              style={styles.bookingButton}
              onPress={openBookingPage}
            >
              <Text style={styles.buttonText}>
                🏡 View Booking Page
              </Text>
            </Pressable>
          ) : null}


          <Pressable
            style={styles.reviewButton}
            onPress={() =>
              router.push(
                `/property/review/${propertyId}`
              )
            }
          >
            <Text style={styles.buttonText}>
              ⭐ Leave a Property Review
            </Text>
          </Pressable>


          {Boolean(
            canClaim && !property.owner_id
          ) ? (
            <ClaimButton
              propertyId={propertyId}
            />
          ) : null}
        </View>


        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Guestbook QR Code
          </Text>

          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>
              Scan to open this property
            </Text>

            <Text style={styles.qrDescription}>
              Guests can scan this code to view
              the property and leave a review.
            </Text>

            <View style={styles.qrWrap}>
              <QRCodeGenerator
                propertyId={propertyId}
              />
            </View>
          </View>
        </View>


        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Reviews
          </Text>

          {reviews.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                No reviews yet
              </Text>

              <Text style={styles.emptySubtext}>
                Be the first guest to share
                their experience.
              </Text>
            </View>
          ) : (
            reviews.map((review) => {
              const reviewPhotos =
                getReviewPhotos(review);

              return (
                <Pressable
                  key={review.id}
                  style={({ pressed }) => [
                    styles.reviewCard,
                    !review.user_id &&
                      styles.reviewCardMuted,
                    pressed &&
                      review.user_id &&
                      styles.reviewCardPressed,
                  ]}
                  onPress={() =>
                    openProfile(review.user_id)
                  }
                  disabled={!review.user_id}
                >
                  <View
                    style={styles.reviewHeader}
                  >
                    <View
                      style={styles.reviewLeft}
                    >
                      <View
                        style={styles.reviewAvatar}
                      >
                        <Text
                          style={
                            styles.reviewAvatarText
                          }
                        >
                          {getInitial(
                            review.name
                          )}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.reviewNameWrap
                        }
                      >
                        <Text
                          style={styles.reviewName}
                        >
                          {review.name ||
                            "Guest"}
                        </Text>

                        <Text
                          style={styles.reviewDate}
                        >
                          {formatReviewDate(
                            review.created_at
                          )}
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={styles.reviewStars}
                    >
                      ⭐ {review.rating}/5
                    </Text>
                  </View>


                  <Text
                    style={styles.reviewComment}
                  >
                    {review.comment}
                  </Text>


                  {reviewPhotos.length > 0 ? (
                    <ScrollView
                      horizontal
                      nestedScrollEnabled
                      showsHorizontalScrollIndicator={
                        false
                      }
                      contentContainerStyle={
                        styles.reviewPhotoRow
                      }
                    >
                      {reviewPhotos.map(
                        (photo, photoIndex) => (
                          <Pressable
                            key={`${review.id}-${photoIndex}`}
                            style={
                              styles.reviewPhotoButton
                            }
                            onPress={(event) =>
                              openReviewPhoto(
                                event,
                                photo
                              )
                            }
                          >
                            <Image
                              source={{ uri: photo }}
                              style={
                                styles.reviewPhoto
                              }
                              resizeMode="cover"
                            />
                          </Pressable>
                        )
                      )}
                    </ScrollView>
                  ) : null}


                  {review.user_id ? (
                    <Text
                      style={styles.reviewHint}
                    >
                      Tap to view profile →
                    </Text>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>


      <Modal
        visible={Boolean(selectedReviewPhoto)}
        transparent
        animationType="fade"
        onRequestClose={closeReviewPhoto}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={styles.modalCloseButton}
            onPress={closeReviewPhoto}
          >
            <Text
              style={styles.modalCloseText}
            >
              ×
            </Text>
          </Pressable>

          <Pressable
            style={styles.modalImageArea}
            onPress={closeReviewPhoto}
          >
            {selectedReviewPhoto ? (
              <Image
                source={{
                  uri: selectedReviewPhoto,
                }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            ) : null}
          </Pressable>
        </View>
      </Modal>
    </>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f6fb",
  },

  content: {
    padding: 16,
    paddingBottom: 36,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f6fb",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#667085",
  },

  section: {
    marginBottom: 18,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#101828",
    marginBottom: 12,
  },

  photoRow: {
    paddingRight: 4,
  },

  photo: {
    width: 290,
    height: 200,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: "#e9edf5",
  },

  photoFallback: {
    height: 170,
    borderRadius: 20,
    backgroundColor: "#e9edf5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  photoFallbackText: {
    color: "#667085",
    fontWeight: "600",
  },

  heroCard: {
    backgroundColor: "white",
    borderRadius: 22,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 3,
    marginBottom: 18,
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  heroTextWrap: {
    flex: 1,
    paddingRight: 12,
  },

  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#101828",
    lineHeight: 36,
  },

  host: {
    marginTop: 8,
    fontSize: 17,
    fontWeight: "700",
    color: "#344054",
  },

  verifiedPill: {
    alignSelf: "flex-start",
    backgroundColor: "#ecfdf3",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 10,
  },

  verifiedText: {
    color: "#027a48",
    fontWeight: "700",
    fontSize: 13,
  },

  editButtonSmall: {
    backgroundColor: "#0066ff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },

  description: {
    marginTop: 14,
    color: "#475467",
    fontSize: 15,
    lineHeight: 22,
  },

  infoCard: {
    marginTop: 14,
    backgroundColor: "#f9fafb",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#eaecf0",
  },

  infoLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#667085",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },

  infoText: {
    fontSize: 15,
    color: "#101828",
    lineHeight: 22,
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },

  statCard: {
    width: "48%",
    backgroundColor: "#f9fafb",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eaecf0",
  },

  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#101828",
  },

  statLabel: {
    marginTop: 4,
    fontSize: 13,
    color: "#667085",
    fontWeight: "600",
  },

  bookingButton: {
    backgroundColor: "#222",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },

  reviewButton: {
    backgroundColor: "#0066ff",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },

  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "800",
    fontSize: 15,
  },

  qrCard: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eaecf0",
    alignItems: "center",
  },

  qrTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#101828",
    textAlign: "center",
  },

  qrDescription: {
    marginTop: 8,
    marginBottom: 18,
    fontSize: 14,
    lineHeight: 20,
    color: "#667085",
    textAlign: "center",
  },

  qrWrap: {
    alignItems: "center",
    justifyContent: "center",
  },

  emptyCard: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eaecf0",
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#101828",
  },

  emptySubtext: {
    marginTop: 6,
    color: "#667085",
    textAlign: "center",
    lineHeight: 20,
  },

  reviewCard: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eaecf0",
  },

  reviewCardMuted: {
    opacity: 0.9,
  },

  reviewCardPressed: {
    transform: [{ scale: 0.99 }],
  },

  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },

  reviewLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 12,
  },

  reviewAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  reviewAvatarText: {
    fontWeight: "800",
    color: "#1d4ed8",
    fontSize: 16,
  },

  reviewNameWrap: {
    flex: 1,
  },

  reviewName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#101828",
  },

  reviewDate: {
    marginTop: 2,
    fontSize: 12,
    color: "#667085",
    fontWeight: "600",
  },

  reviewStars: {
    fontWeight: "800",
    color: "#f5a623",
  },

  reviewComment: {
    fontSize: 16,
    lineHeight: 22,
    color: "#344054",
  },

  reviewPhotoRow: {
    paddingTop: 14,
    paddingRight: 4,
  },

  reviewPhotoButton: {
    marginRight: 10,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#e9edf5",
  },

  reviewPhoto: {
    width: 145,
    height: 145,
    borderRadius: 14,
    backgroundColor: "#e9edf5",
  },

  reviewHint: {
    marginTop: 12,
    fontSize: 12,
    color: "#0066ff",
    fontWeight: "700",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.94)",
    alignItems: "center",
    justifyContent: "center",
  },

  modalImageArea: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 70,
  },

  modalImage: {
    width: "100%",
    height: "100%",
  },

  modalCloseButton: {
    position: "absolute",
    top: 45,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor:
      "rgba(255, 255, 255, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  modalCloseText: {
    color: "white",
    fontSize: 34,
    lineHeight: 36,
    fontWeight: "400",
  },
});