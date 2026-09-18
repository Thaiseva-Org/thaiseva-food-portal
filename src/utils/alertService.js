class AlertService {
  constructor() {
    this.listeners = [];
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  alert(message, title = "Message") {
    this.listeners.forEach((listener) => listener({ message, title }));
  }
}

export const alertService = new AlertService();

export const customAlert = (message, title = "Message") => {
  alertService.alert(message, title);
};
