#![allow(clippy::too_many_arguments)]

pub mod application;
pub mod config;
pub mod domain;
pub mod infrastructure;
pub mod presentation;
pub mod state;

pub use config::Config;
pub use state::AppState;
