import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Button } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { LocationAccuracy } from 'expo-location';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowAlert: true,
		shouldPlaySound: false,
		shouldSetBadge: false,
	}),
});

const BACKGROUND_FETCH_TASK = 'background-fetch';
let myVar = 0;
// 1. Define the task by providing a name and the function that should be executed
// Note: This needs to be called in the global scope (e.g outside of your React components)
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async ({ data }) => {
	const now = Date.now();

	console.log(
		`Got background fetch call at date: ${new Date(now).toISOString()}`
	);

  alert('Background fetch is running!');
  await schedulePushNotification("From background service");
	myVar = 100;
	console.log(data, 'data');
	// Be sure to return the successful result type!
	return BackgroundFetch.BackgroundFetchResult.NewData;
});

// 2. Register the task at some point in your app by providing the same name, and some configuration options for how the background fetch should behave
// Note: This does NOT need to be in the global scope and CAN be used in your React components!
async function registerBackgroundFetchAsync() {
	return BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
		minimumInterval: 15, // 15 seconds
		stopOnTerminate: false, // android only,
		startOnBoot: true, // android only
	});
}

// 3. (Optional) Unregister tasks by specifying the task name
// This will cancel any future background fetch calls that match the given name
// Note: This does NOT need to be in the global scope and CAN be used in your React components!
async function unregisterBackgroundFetchAsync() {
	return BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
}

async function schedulePushNotification(msg='') {
	await Notifications.scheduleNotificationAsync({
		content: {
			title: msg + " You've got mail! 📬",
			body: msg + ' Here is the notification body',
			data: { data: 'goes here' },
		},
		trigger: { seconds: 2, repeats: false },
	});
}

async function registerForPushNotificationsAsync() {
	let token;
	if (Constants.isDevice) {
		const { status: existingStatus } =
			await Notifications.getPermissionsAsync();
		let finalStatus = existingStatus;
		if (existingStatus !== 'granted') {
			const { status } = await Notifications.requestPermissionsAsync();
			finalStatus = status;
		}
		if (finalStatus !== 'granted') {
			alert('Failed to get push token for push notification!');
			return;
		}
		token = (await Notifications.getExpoPushTokenAsync()).data;
		console.log(token);
	} else {
		alert('Must use physical device for Push Notifications');
	}

	if (Platform.OS === 'android') {
		Notifications.setNotificationChannelAsync('default', {
			name: 'default',
			importance: Notifications.AndroidImportance.MAX,
			vibrationPattern: [0, 250, 250, 250],
			lightColor: '#FF231F7C',
		});
	}

	return token;
}

export default function BackgroundFetchScreen() {
	const [isRegistered, setIsRegistered] = React.useState(false);
	const [status, setStatus] = React.useState(null);
	const [expoPushToken, setExpoPushToken] = useState('');
	const [notification, setNotification] = useState(false);
	const notificationListener = useRef();
	const responseListener = useRef();

	React.useEffect(() => {
		(async () => {
			try {
				let { status: fg_status } =
					await Location.requestForegroundPermissionsAsync();
				if (fg_status !== 'granted') {
					setErrorMsg('Permission to access location was denied');
					return;
				} else {
					let { status: bg_status } =
						await Location.requestBackgroundPermissionsAsync();
					console.log({ bg_status });
				}

				let location = await Location.startLocationUpdatesAsync(
					BACKGROUND_FETCH_TASK,
					{
						accuracy: LocationAccuracy.Highest,
						timeInterval: 1000,
						distanceInterval: 0.001,
						foregroundService: {
							notificationTitle: 'App is running in background',
							notificationBody: 'notificationBody',
							notificationColor: '#111238',
						},
					}
				);
				console.log(location);
        if (location) {
          await schedulePushNotification("From location change service");
        }

				registerForPushNotificationsAsync().then((token) =>
					setExpoPushToken(token)
				);

				notificationListener.current =
					Notifications.addNotificationReceivedListener((notification) => {
						setNotification(notification);
					});

				responseListener.current =
					Notifications.addNotificationResponseReceivedListener((response) => {
						console.log(response);
					});
			} catch (error) {
				alert(error);
			}
			return () => {
				Notifications.removeNotificationSubscription(
					notificationListener.current
				);
				Notifications.removeNotificationSubscription(responseListener.current);
			};
		})();

		// checkStatusAsync();
		console.log('BackgroundFetchScreen mounted');
	}, []);

	const checkStatusAsync = async () => {
		BackgroundFetch.setMinimumIntervalAsync(15);
		const status = await BackgroundFetch.getStatusAsync();
		const isRegistered = await TaskManager.isTaskRegisteredAsync(
			BACKGROUND_FETCH_TASK
		);
		setStatus(status);
		setIsRegistered(isRegistered);
	};

	const toggleFetchTask = async () => {
		if (isRegistered) {
			await unregisterBackgroundFetchAsync();
		} else {
			await registerBackgroundFetchAsync();
		}

		checkStatusAsync();
	};

	return (
		<View style={styles.screen}>
			<View style={styles.textContainer}>
				<Text>myVar: {myVar}</Text>
				<Text>
					Background fetch status:{' '}
					<Text style={styles.boldText}>
						{status ? BackgroundFetch.BackgroundFetchStatus[status] : null}
					</Text>
				</Text>
				<Text>
					Background fetch task name:{' '}
					<Text style={styles.boldText}>
						{isRegistered ? BACKGROUND_FETCH_TASK : 'Not registered yet!'}
					</Text>
				</Text>
			</View>
			<View style={styles.textContainer}></View>
			<Button
				title={
					isRegistered
						? 'Unregister BackgroundFetch task'
						: 'Register BackgroundFetch task'
				}
				onPress={toggleFetchTask}
			/>

			<Text>Your expo push token: {expoPushToken}</Text>
			<View style={{ alignItems: 'center', justifyContent: 'center' }}>
				<Text>
					Title: {notification && notification.request.content.title}{' '}
				</Text>
				<Text>Body: {notification && notification.request.content.body}</Text>
				<Text>
					Data:{' '}
					{notification && JSON.stringify(notification.request.content.data)}
				</Text>
			</View>
			<Button
				title='Press to schedule a notification'
				onPress={async () => {
					await schedulePushNotification();
				}}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},

	textContainer: {
		margin: 10,
	},
	boldText: {
		fontWeight: 'bold',
	},
});
