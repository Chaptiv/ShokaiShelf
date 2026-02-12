import React, { Component, ErrorInfo, ReactNode } from "react";
import { MdErrorOutline, MdRefresh, MdContentCopy } from "react-icons/md";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReload = () => {
        window.location.reload();
    };

    handleCopy = () => {
        const text = `Error: ${this.state.error?.toString()}\n\nStack:\n${this.state.errorInfo?.componentStack}`;
        navigator.clipboard.writeText(text);
        alert("Fehlerdetails kopiert!");
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    height: "100vh",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#0f172a",
                    color: "white",
                    fontFamily: "Inter, sans-serif",
                    padding: 20,
                    textAlign: "center"
                }}>
                    <MdErrorOutline size={64} color="#ef4444" style={{ marginBottom: 24 }} />
                    <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Ups, etwas ist schiefgelaufen.</h1>
                    <p style={{ opacity: 0.7, marginBottom: 32, maxWidth: 400 }}>
                        ShokaiShelf ist abgestürzt. Das tut uns leid. Bitte lade die App neu oder kopiere den Fehlerbericht.
                    </p>

                    <div style={{ display: "flex", gap: 16 }}>
                        <button
                            onClick={this.handleReload}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "12px 24px",
                                background: "#3b82f6",
                                border: "none",
                                borderRadius: 8,
                                color: "white",
                                fontWeight: 600,
                                cursor: "pointer"
                            }}
                        >
                            <MdRefresh size={20} />
                            Neu laden
                        </button>

                        <button
                            onClick={this.handleCopy}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "12px 24px",
                                background: "rgba(255,255,255,0.1)",
                                border: "1px solid rgba(255,255,255,0.2)",
                                borderRadius: 8,
                                color: "white",
                                fontWeight: 600,
                                cursor: "pointer"
                            }}
                        >
                            <MdContentCopy size={20} />
                            Details kopieren
                        </button>
                    </div>

                    {process.env.NODE_ENV === 'development' && this.state.error && (
                        <pre style={{
                            marginTop: 40,
                            padding: 16,
                            background: "rgba(0,0,0,0.3)",
                            borderRadius: 8,
                            textAlign: "left",
                            maxWidth: 800,
                            overflow: "auto",
                            fontSize: 12,
                            fontFamily: "monospace",
                            opacity: 0.8
                        }}>
                            {this.state.error.toString()}
                            <br />
                            {this.state.errorInfo?.componentStack}
                        </pre>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
