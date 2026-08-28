import numpy as np
import pandas as pd
from typing import Optional, List, Dict, Any
from sklearn.cluster import DBSCAN
from app.core.logging import logger


class SpatioTemporalClusterer:
    """
    Clusters spatial satellite observations into physical ground events using
    DBSCAN with a spherical Haversine distance metric.
    """

    EARTH_RADIUS_METERS = 6371000.0

    def __init__(self, spatial_radius_meters: float = 750.0, min_samples: int = 1):
        """
        :param spatial_radius_meters: Maximum spatial distance (epsilon) to group points into the same cluster.
        :param min_samples: Minimum observations required to form a cluster core.
        """
        self.spatial_radius_meters = spatial_radius_meters
        self.min_samples = min_samples
        # Convert spatial radius in meters to radians for Haversine metric
        self.eps_radians = self.spatial_radius_meters / self.EARTH_RADIUS_METERS

    def cluster_observations(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Takes a DataFrame containing 'latitude' and 'longitude' and appends
        a 'cluster_id' column grouping co-located detections.
        """
        if df.empty or len(df) == 0:
            df["cluster_id"] = []
            return df

        df_clustered = df.copy()

        # Extract coordinates and convert to radians (lat, lon order for sklearn haversine)
        coords = np.radians(df_clustered[["latitude", "longitude"]].to_numpy())

        db = DBSCAN(
            eps=self.eps_radians,
            min_samples=self.min_samples,
            metric="haversine"
        )
        labels = db.fit_predict(coords)

        # Generate readable cluster IDs (e.g., CLUSTER_001, CLUSTER_002, ...)
        cluster_ids = []
        for lbl in labels:
            if lbl == -1:
                cluster_ids.append("ISOLATED_NOISE")
            else:
                cluster_ids.append(f"CLUSTER_{lbl + 1:03d}")

        df_clustered["cluster_id"] = cluster_ids
        num_clusters = len(set(labels) - {-1})
        logger.info(f"DBSCAN clustered {len(df_clustered)} observations into {num_clusters} distinct spatial clusters.")

        return df_clustered
