import { useState, useEffect } from 'react';

export const useMaintenanceTimer = (startDateString?: string) => {
    const [label, setLabel] = useState("Reciente");

    useEffect(() => {
        if (!startDateString) return;

        const update = () => {
            const start = new Date(startDateString);
            const now = new Date();
            const diffMs = now.getTime() - start.getTime();
            const oneDayMs = 1000 * 60 * 60 * 24;

            if (diffMs > oneDayMs) {
                const days = Math.floor(diffMs / oneDayMs);
                setLabel(`${days} día${days > 1 ? 's' : ''}`);
            } else {
                const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
                const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
                const seconds = Math.floor((diffMs / 1000) % 60);
                const pad = (n: number) => n.toString().padStart(2, '0');
                setLabel(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
            }
        };

        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [startDateString]);

    return label;
};
