import { motion } from "framer-motion";
import { Brain } from "lucide-react";

export function SplashScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col items-center gap-4"
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary-foreground/15 backdrop-blur-sm">
          <Brain className="h-14 w-14 text-primary-foreground" />
        </div>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-center"
        >
          <h1 className="text-3xl font-bold tracking-tight text-primary-foreground">
            CogniRaja
          </h1>
          <p className="mt-1 text-sm text-primary-foreground/70">
            Académie Raja Casablanca
          </p>
        </motion.div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="absolute bottom-16"
      >
        <div className="h-1 w-16 overflow-hidden rounded-full bg-primary-foreground/20">
          <motion.div
            className="h-full rounded-full bg-primary-foreground"
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </div>
  );
}
