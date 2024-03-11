import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Image } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { Audio } from 'expo-av';

const db = SQLite.openDatabase('soundApp.db');

export default function App() {
    const [preProgrammedSounds, setPreProgrammedSounds] = useState([
        { id: 1, title: 'Sound 1', soundUri: require('./assets/sfx/sound.mp3') },
        { id: 2, title: 'Sound 2', soundUri: require('./assets/sfx/sound1.mp3') },
        { id: 3, title: 'Sound 3', soundUri: require('./assets/sfx/sound2.mp3') },
    ]);

    const [recordedSounds, setRecordedSounds] = useState([]);
    const [recording, setRecording] = useState();
    const [isRecording, setIsRecording] = useState(false);
    const [playingSound, setPlayingSound] = useState(null);

    const [showIntro, setShowIntro] = useState(true);

    useEffect(() => {
        db.transaction((tx) => {
            tx.executeSql(
                'CREATE TABLE IF NOT EXISTS sounds (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, soundUri TEXT);'
            );
        });
    }, []);

    const getAudioPermission = async () => {
        const { granted } = await Audio.requestPermissionsAsync();
        if (!granted) {
            alert('Audio recording permission required');
            return false;
        }
        return true;
    };

    const setupAudioMode = async () => {
        await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
        });
    };

    const playPreloadedSound = async (uri, soundId) => {
        try {
            if (playingSound && playingSound.isPlaying && playingSound.soundId === soundId) {
                await playingSound.pauseAsync();
                setPlayingSound(null);
            } else {
                const soundObject = new Audio.Sound();
                await soundObject.loadAsync(uri);
                await soundObject.playAsync();
                setPlayingSound({ soundObject, soundId });
            }
        } catch (error) {
            console.error('Error playing preloaded sound:', error);
        }
    };

    const playRecordedSound = async (uri) => {
        try {
            const { sound } = await Audio.Sound.createAsync(
                { uri },
                { shouldPlay: true }
            );
            await sound.playAsync();
        } catch (error) {
            console.error('Error playing recorded sound:', error);
        }
    };

    const recordSound = async () => {
        const hasPermission = await getAudioPermission();
        if (hasPermission) {
            try {
                await setupAudioMode();

                if (!isRecording) {
                    const { recording } = await Audio.Recording.createAsync(
                        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
                    );
                    setRecording(recording);
                    setIsRecording(true);
                } else {
                    await recording.stopAndUnloadAsync();
                    const info = await recording.getURI();
                    saveRecordedSound(info);
                    setRecording(undefined);
                    setIsRecording(false);
                }
            } catch (error) {
                console.error('Recording failed:', error);
            }
        }
    };

    const saveRecordedSound = (uri) => {
        db.transaction(
            (tx) => {
                tx.executeSql(
                    'INSERT INTO sounds (title, soundUri) VALUES (?, ?)',
                    [`Recorded Sound ${recordedSounds.length + 1}`, uri],
                    (_, results) => {
                        if (results.insertId !== undefined) {
                            setRecordedSounds([
                                ...recordedSounds,
                                {
                                    id: results.insertId,
                                    title: `Recorded Sound ${recordedSounds.length + 1}`,
                                    soundUri: uri,
                                },
                            ]);
                        }
                    }
                );
            },
            null,
            console.error
        );
    };

    const removeRecordedSound = (id) => {
        db.transaction(
            (tx) => {
                tx.executeSql(
                    'DELETE FROM sounds WHERE id = ?',
                    [id],
                    () => {
                        setRecordedSounds(recordedSounds.filter((sound) => sound.id !== id));
                    },
                    console.error
                );
            },
            null,
            console.error
        );
    };

    const renderButton = (title, onPress) => (
        <TouchableOpacity
            style={[
                styles.button,
                title === 'Start Recording' && isRecording && styles.recordingButton,
            ]}
            onPress={onPress}
        >
            <Text style={{ color: 'black' }}>
                {title}
            </Text>
        </TouchableOpacity>
    );

    const renderIntro = () => (
        <View style={styles.introContainer}>
            <Text style={styles.heading}>
                Sound Mixer
            </Text>
            <Image source={require('./assets/logo.jpg')} style={styles.logo} />
            <Text style={styles.description}>
                Welcome to Sound Mixer! Use this application to create your own music. It allows you to record your own audio and play it back along with some preloaded sounds.
            </Text>
            <TouchableOpacity style={styles.button} onPress={() => {
                setShowIntro(false);
                playPreloadedSound(preProgrammedSounds[0].soundUri, 1);
            }}>
                <Text>Get Started</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            {showIntro ? renderIntro() : (
                <View>
                    <Text style={styles.heading}>Sound App</Text>
                    <Text style={styles.heading_text}>(Please RECORD some sounds before play any.)</Text>

                    <Text style={styles.subHeading}>Preloaded Sounds</Text>
                    {preProgrammedSounds.map((sound) => (
                        <TouchableOpacity
                            key={sound.id}
                            style={styles.button}
                            onPress={() => playPreloadedSound(sound.soundUri, sound.id)}
                        >
                            <Text>{sound.title}</Text>
                        </TouchableOpacity>
                    ))}

                    <Text style={styles.subHeading}>Recorded Sounds</Text>
                    <FlatList
                        data={recordedSounds}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={({ item }) => (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <TouchableOpacity
                                    style={styles.button}
                                    onPress={() => playRecordedSound(item.soundUri)}
                                >
                                    <Text>{item.title}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.deleteButton}
                                    onPress={() => removeRecordedSound(item.id)}
                                >
                                    <Text style={{ color: 'white' }}>X</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    />

                    <Text style={styles.subHeading}>Start Recording</Text>
                    <View style={styles.recordingButtonContainer}>
                        {renderButton(isRecording ? 'Stop Recording' : 'Start Recording', recordSound)}
                        {isRecording && <Image source={require('./assets/recording.gif')} style={styles.recordingIndicator} />}
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    introContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    logo: {
        width: 500,
        height: 300,
        resizeMode: 'cover',
        marginBottom: 20,
    },
    description: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 30,
    },
    heading: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
        marginTop: 100,
    },
    button: {
        margin: 10,
        padding: 15,
        backgroundColor: 'lightgreen',
        borderRadius: 5,
    },
    subHeading: {
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 10,
        marginBottom: 10,
    },
    recordingButtonContainer: {
        marginBottom: 200,
    },
    recordingButton: {
        margin: 10,
        padding: 15,
        backgroundColor: '#DDDDDD',
        borderRadius: 5,
    },
    deleteButton: {
        backgroundColor: 'red',
        padding: 14,
        borderRadius: 5,
    },
    recordingIndicator: {
        width: 150,
        height: 25,
        alignSelf: 'center',
        marginTop: 10,
        borderRadius: 5,
    },
});
