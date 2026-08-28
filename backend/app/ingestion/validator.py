from typing import List, Tuple, Dict, Any, Optional
import pandas as pd
from pydantic import ValidationError
from app.models.schemas import RawObservationCreate
from app.core.logging import logger


class ObservationValidator:
    """
    Validates and sanitizes raw dictionaries or Pandas rows of satellite observations.
    Filters out invalid coordinates, impossible physical values, and logs rejections.
    """

    @staticmethod
    def validate_single_record(record: Dict[str, Any]) -> Tuple[bool, Optional[RawObservationCreate], Optional[str]]:
        """
        Validates a single observation dictionary.
        Returns: (is_valid, validated_model_or_none, error_message_or_none)
        """
        try:
            validated = RawObservationCreate(**record)
            return True, validated, None
        except ValidationError as e:
            err_msg = "; ".join([f"{err['loc']}: {err['msg']}" for err in e.errors()])
            return False, None, err_msg
        except Exception as e:
            return False, None, str(e)

    @classmethod
    def validate_batch(
        cls, 
        records: List[Dict[str, Any]]
    ) -> Tuple[List[RawObservationCreate], List[Dict[str, Any]]]:
        """
        Validates a batch of raw records.
        Returns: (list_of_valid_models, list_of_rejected_records_with_reasons)
        """
        valid_models: List[RawObservationCreate] = []
        rejected: List[Dict[str, Any]] = []

        for row in records:
            is_valid, model, reason = cls.validate_single_record(row)
            if is_valid and model is not None:
                valid_models.append(model)
            else:
                rejected.append({"raw_data": row, "reason": reason})

        logger.info(
            f"Validation complete: {len(valid_models)} valid records, "
            f"{len(rejected)} rejected records."
        )
        return valid_models, rejected

    @classmethod
    def validate_dataframe(
        cls, 
        df: pd.DataFrame
    ) -> Tuple[List[RawObservationCreate], List[Dict[str, Any]]]:
        """
        Converts a Pandas DataFrame from CSV/API into dictionaries and validates them.
        """
        if df.empty:
            return [], []
        
        # Lowercase all column names for consistency
        df_clean = df.copy()
        df_clean.columns = [str(c).strip().lower() for c in df_clean.columns]
        
        records = df_clean.to_dict(orient="records")
        return cls.validate_batch(records)
